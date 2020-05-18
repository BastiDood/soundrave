// NODE CORE IMPORTS
import { strict as assert } from 'assert';

// FETCHERS
import { SpotifyAPI } from '../fetchers/Spotify';

// CACHE
import { Cache } from '../db/Cache';

// ERRORS
import { SpotifyAPIError } from '../errors/SpotifyAPIError';

// GLOBAL VARIABLES
const ONE_DAY = 24 * 60 * 60 * 1e3;

export class DataController {
  static readonly STALE_PERIOD = {
    FOLLOWED_ARTISTS: ONE_DAY * 3,
    USER_OBJ: ONE_DAY * 7,
    ARTIST_OBJ: ONE_DAY * 4,
    LAST_DONE: ONE_DAY * 5,
  };

  /** Copy of the current user's session */
  #user: UserObject;
  /** Handler for all API fetches */
  #api: SpotifyAPI;

  constructor(user: UserObject, token: SpotifyAccessToken) {
    this.#user = user;
    this.#api = SpotifyAPI.restore(token);
  }

  get tokenInfo(): Readonly<SpotifyAccessToken> { return this.#api.tokenInfo; }

  private get isUserObjectStale(): boolean {
    return Date.now() > this.#user.profile.retrievalDate + DataController.STALE_PERIOD.USER_OBJ;
  }

  private get areFollowedArtistsStale(): boolean {
    return Date.now() > this.#user.followedArtists.retrievalDate + DataController.STALE_PERIOD.FOLLOWED_ARTISTS;
  }

  private get isLastDoneStale(): boolean {
    return !this.#user.job.isRunning
      && Date.now() > this.#user.job.dateLastDone + DataController.STALE_PERIOD.LAST_DONE;
  }

  private async getUserProfile(): Promise<Result<Readonly<UserProfileInfo>, SpotifyAPIError>> {
    if (!this.isUserObjectStale) {
      console.log('Retrieving user profile from the session CACHE...');
      return {
        ok: true,
        value: this.#user.profile,
      };
    }

    console.log('Fetching user profile from Spotify API...');
    const partial = await this.#api.fetchUserProfile();
    if (!partial.ok) {
      console.log(`Encountered an error while fetching the user profile for ${this.#user.profile.name.toUpperCase()}.`);
      console.error(partial.error);
      return partial;
    }

    const { value: user } = partial;
    this.#user._id = user._id;
    this.#user.profile = user.profile;
    await Cache.updateUserProfile(this.#user);
    return {
      ok: partial.ok,
      value: this.#user.profile,
    };
  }

  private async *getFollowedArtistsIDs(): AsyncGenerator<string[], SpotifyAPIError|undefined> {
    const user = this.#user;
    if (!this.areFollowedArtistsStale) {
      console.log('Retrieving followed artist IDs from the session CACHE...');
      yield user.followedArtists.ids;
      return;
    }

    console.log('Fetching followed artist IDs from the Spotify API...');
    const iterator = this.#api.fetchFollowedArtists(user.followedArtists.etag);
    const ids: string[] = [];
    let error: SpotifyAPIError|undefined;
    while (true) {
      const result = await iterator.next();
      assert(typeof result.done !== 'undefined');

      if (result.done) {
        const followedArtistsError = result.value;
        if (followedArtistsError) {
          console.log(`Encountered an error while fetching ${this.#user.profile.name.toUpperCase()}'s followed artist IDs.`);
          console.error(followedArtistsError);
          error = followedArtistsError;
        }
        break;
      }

      console.log('One batch of followed artist IDs successfully pulled.');
      const { resource, etag } = result.value;
      if (resource) {
        console.log('Setting the new followed artists from the fetch...');
        const idsBatch = resource.map(artist => artist._id);
        // TODO: Optimize this by creating a specific query for appending multiple elements
        ids.splice(ids.length, 0, ...idsBatch);
        this.#user.followedArtists = {
          ids,
          etag,
          retrievalDate: Date.now(),
        };

        await Promise.all([
          Cache.upsertManyArtistObjects(resource),
          Cache.updateFollowedArtistsByUserObject(user),
        ]);
        yield idsBatch;
      } else {
        console.log('Retrieving from CACHE due to matching ETag...');
        yield user.followedArtists.ids;
      }
    }

    return error;
  }

  private async getSeveralArtists(ids: string[]): Promise<ArtistsRetrieval> {
    const existingArtists = await Cache.retrieveArtists(ids);
    const existingIDs = existingArtists.map(artist => artist._id);
    console.log(`Found ${existingIDs.length} existing artists in the CACHE.`);

    // TODO: Optimize this to be more efficient (particularly check if the length of two arrays are equal)
    // Find the difference between known IDs and new IDs
    const unknownIDs = ids.filter(id => !existingIDs.includes(id));

    // Fetch the unknown artists
    console.log(`Now fetching ${unknownIDs.length} artists from the Spotify API...`);
    const errors: SpotifyAPIError[] = [];
    const artistsResultBatches = await this.#api.fetchSeveralArtists(unknownIDs);
    for (const batch of artistsResultBatches) {
      if (batch.ok) {
        existingArtists.splice(existingArtists.length, 0, ...batch.value);
        continue;
      }

      console.log('Encountered an error while fetching for a batch of artists.');
      console.error(batch.error);
      errors.push(batch.error);
    }

    return {
      artists: existingArtists,
      errors,
    };
  }

  async *getReleases(limit = 0): AsyncGenerator<ReleasesRetrieval> {
    const profileResult = await this.getUserProfile();
    if (!profileResult.ok)
      return { releases: [], errors: [ profileResult.error ] };
    const { country } = profileResult.value;
    const user = this.#user;

    const fetchErrors: SpotifyAPIError[] = [];
    const artistIDsIterator = this.getFollowedArtistsIDs();
    while (true) {
      const artistIDsResult = await artistIDsIterator.next();
      assert(typeof artistIDsResult.done !== 'undefined');

      if (artistIDsResult.done) {
        const artistIDsError = artistIDsResult.value;
        if (artistIDsError)
          fetchErrors.push(artistIDsError);
        yield { releases: [], errors: fetchErrors };
        break;
      }

      const artistIDs = artistIDsResult.value;
      if (!this.isLastDoneStale) {
        console.log(`Retrieving the releases of ${artistIDs.length} artists from the database CACHE...`);
        yield {
          releases: await Cache.retrieveReleasesFromArtists(artistIDs, country, -limit),
          errors: [],
        };
        break;
      }

      // Officially begin a new job
      console.log(`Beginning new job for ${user.profile.name.toUpperCase()}...`);
      user.job.isRunning = true;
      await Cache.updateJobStatusForUser(user);

      // TODO: Optimize this by batching together multiple batches of followed artists
      // Retrieve followed artists, even those who do not exist from the cache yet
      const { artists, errors } = await this.getSeveralArtists(artistIDs);
      fetchErrors.splice(fetchErrors.length, 0, ...errors);

      // Segregate the stale artist objects
      const staleArtists = artists
        .filter(artist => Date.now() > artist.retrievalDate + DataController.STALE_PERIOD.ARTIST_OBJ);
      console.log(`${staleArtists.length} followed artists are considered new or stale, thus requiring an equal number of release fetches.`);

      // Concurrently request for all releases
      const releaseFetches = staleArtists
        .map(async (artist): Promise<ArtistObject|SpotifyAPIError> => {
          const pendingOperations: Promise<void>[] = [];
          const releaseIterator = this.#api.fetchReleasesByArtistID(artist._id);
          let releasesError: SpotifyAPIError|undefined;
          while (true) {
            const releasesResult = await releaseIterator.next();
            assert(typeof releasesResult.done !== 'undefined');

            if (releasesResult.done) {
              const lastValue = releasesResult.value;
              if (lastValue) {
                console.error(`Encountered an error while fetching ${artist.name}'s releases.`);
                releasesError = lastValue;
              }
              break;
            }

            // TODO: For v1.0, make sure to query for other featured artists
            // who are not necessarily followed by the current user

            pendingOperations.push(Cache.upsertManyReleaseObjects(releasesResult.value));
            console.log(`Fetched ${releasesResult.value.length} releases from ${artist.name}.`);
          }

          await Promise.all(pendingOperations);
          console.log(`Finished updating database information for ${artist.name}.`);
          return releasesError ?? artist;
        });

      const settledFetches = await Promise.all(releaseFetches);
      console.log('All fetches settled.');

      // Segregate successful fetches
      const NOW = Date.now();
      const fetchResults = settledFetches
        .reduce((prev, curr) => {
          if (curr instanceof SpotifyAPIError)
            prev.errors.push(curr);
          else {
            curr.retrievalDate = NOW;
            prev.artists.push(curr);
          }
          return prev;
        }, { artists: [] as ArtistObject[], errors: [] as SpotifyAPIError[] });

      // Save all artists to the database cache
      await Cache.upsertManyArtistObjects(fetchResults.artists);

      console.log(`Releases of one batch of followed artists retrieved: ${fetchResults.artists.length} successes and ${fetchResults.errors.length} errors.`);
      yield {
        releases: await Cache.retrieveReleasesFromArtists(artistIDs, country, -limit),
        errors: fetchResults.errors,
      };
    }

    user.job = {
      isRunning: false,
      dateLastDone: fetchErrors.length < 1 ? Date.now() : user.job.dateLastDone,
    };
    await Cache.updateJobStatusForUser(this.#user);
  }
}
