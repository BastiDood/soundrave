// NODE CORE IMPORTS
import { strict as assert } from 'assert';

// GLOBALS
import { env } from '../globals/env';

// FETCHERS
import { SpotifyAPI } from '../fetchers/Spotify';

// DATABASE
import { Cache } from '../db/Cache';
import { Session } from '../db/Session';

// UTILITY FUNTIONS
import { getArrayDifference } from '../util';

// TYPES
import { SpotifyAPIError } from '../errors/SpotifyAPIError';
import { OAuthError } from '../errors/OAuthError';

// GLOBAL VARIABLES
const ONE_DAY = 24 * 60 * 60 * 1e3;

export class DataController {
  static readonly STALE_PERIOD = {
    /** This should only be queried by the route-level. */
    LAST_DONE: ONE_DAY,
    FOLLOWED_ARTISTS: ONE_DAY * 3,
    ARTIST_RELEASES: ONE_DAY * 4,
    USER_PROFILE: ONE_DAY * 7,
  };

  /** Copy of the current user's session */
  #user: UserObject;
  /** Handler for all API fetches */
  #api: SpotifyAPI;

  constructor(sessionID: string, user: UserObject, token: AccessToken) {
    this.#user = user;
    this.#api = SpotifyAPI.restore(token);

    // Listen for any access token updates
    this.#api.on('__token_update__', Session.updateToken.bind(Session, sessionID, 'spotify'));
  }

  get tokenInfo(): Readonly<AccessToken> { return this.#api.tokenInfo; }

  private get isUserObjectStale(): boolean {
    return Date.now() > this.#user.profile.retrievalDate + DataController.STALE_PERIOD.USER_PROFILE;
  }

  private get areFollowedArtistsStale(): boolean {
    return Date.now() > this.#user.followedArtists.retrievalDate + DataController.STALE_PERIOD.FOLLOWED_ARTISTS;
  }

  private async getUserProfile(): Promise<Result<Readonly<UserProfileInfo>, OAuthError|SpotifyAPIError>> {
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

  private async *getFollowedArtistsIDs(): AsyncGenerator<string[], OAuthError|SpotifyAPIError|undefined> {
    const user = this.#user;
    if (!this.areFollowedArtistsStale) {
      console.log('Retrieving followed artist IDs from the session CACHE...');
      yield user.followedArtists.ids;
      return;
    }

    console.log('Fetching followed artist IDs from the Spotify API...');
    const iterator = this.#api.fetchFollowedArtists(user.followedArtists.etag);
    const ids: string[] = [];
    let error: OAuthError|SpotifyAPIError|undefined;
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

    // Find the difference between known IDs and new IDs
    const unknownIDs = getArrayDifference(ids, existingIDs);

    // Fetch the unknown artists
    console.log(`Now fetching ${unknownIDs.length} artists from the Spotify API...`);
    const errors: (OAuthError|SpotifyAPIError)[] = [];
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

  async *getReleases(): AsyncGenerator<ReleasesRetrieval> {
    const profileResult = await this.getUserProfile();
    if (!profileResult.ok)
      return { releases: [], errors: [ profileResult.error ] };
    const { country } = profileResult.value;
    const user = this.#user;

    const fetchErrors: (OAuthError|SpotifyAPIError)[] = [];
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

      // Officially begin a new job
      console.log(`Beginning new job for ${user.profile.name.toUpperCase()}...`);
      user.job.isRunning = true;
      await Cache.updateJobStatusForUser(user);

      // TODO: Optimize this by batching together multiple batches of followed artists
      // Retrieve followed artists, even those who do not exist from the cache yet
      const artistIDs = artistIDsResult.value;
      const { artists, errors } = await this.getSeveralArtists(artistIDs);
      fetchErrors.splice(fetchErrors.length, 0, ...errors);

      // Segregate the stale artist objects
      const staleArtists = artists
        .filter(artist => Date.now() > artist.retrievalDate + DataController.STALE_PERIOD.ARTIST_RELEASES);
      console.log(`${staleArtists.length} followed artists are considered new or stale, thus requiring an equal number of release fetches.`);

      // Declare interface for the results
      interface ReleaseFetchResult {
        result: ArtistObject|OAuthError|SpotifyAPIError;
        releases: NonPopulatedReleaseObject[];
      }

      // Concurrently request for all releases
      const releaseFetches = staleArtists
        .map(async (artist): Promise<ReleaseFetchResult> => {
          const artistReleases: NonPopulatedReleaseObject[] = [];
          const releaseIterator = this.#api.fetchReleasesByArtistID(artist._id);
          let releasesError: OAuthError|SpotifyAPIError|undefined;
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

            artistReleases.splice(artistReleases.length, 0, ...releasesResult.value);
            console.log(`Fetched ${releasesResult.value.length} releases from ${artist.name}.`);
          }

          console.log(`Finished fetching data for ${artist.name} with ${releasesError ? 'some' : 'no'} errors.`);
          return { result: releasesError ?? artist, releases: artistReleases };
        });

      const settledFetches = await Promise.all(releaseFetches);
      console.log('All fetches settled.');

      // Segregate successful fetches
      const NOW = Date.now();
      const fetchResults = settledFetches
        .reduce((prev, curr) => {
          if (curr.result instanceof Error)
            prev.errors.push(curr.result);
          else {
            curr.result.retrievalDate = NOW;
            prev.artists.push(curr.result);
          }
          prev.releases.splice(prev.releases.length, 0, ...curr.releases);
          return prev;
        }, { artists: [] as ArtistObject[], releases: [] as NonPopulatedReleaseObject[], errors: [] as (OAuthError|SpotifyAPIError)[] });

      // Save all artists and releases to the database cache
      await Promise.all([
        Cache.upsertManyArtistObjects(fetchResults.artists),
        Cache.upsertManyReleaseObjects(fetchResults.releases),
      ]);

      console.log(`Releases of one batch of followed artists retrieved: ${fetchResults.artists.length} successes and ${fetchResults.errors.length} errors.`);
      yield {
        // TODO: Determine limit of releases based on user's premium status
        releases: await Cache.retrieveReleasesFromArtists(artistIDs, country, -env.MAX_RELEASES),
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
