// NODE CORE IMPORTS
import { promisify } from 'util';
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
  private static readonly STALE_PERIOD = {
    FOLLOWED_ARTISTS: ONE_DAY * 3,
    USER_OBJ: ONE_DAY * 7,
    ARTIST_OBJ: ONE_DAY * 4,
    LAST_DONE: ONE_DAY * 5,
  };

  /** Reference to the current user's session */
  #session: Express.Session;
  /** Handler for all API fetches */
  #api: SpotifyAPI;
  /** Utility function for manually saving the current session */
  #saveSession: () => Promise<void>;

  constructor(session: Express.Session) {
    this.#session = session;
    this.#api = SpotifyAPI.restore(this.#session.token.spotify);
    this.#saveSession = promisify(this.#session.save.bind(this.#session));
  }

  get isUserObjectStale(): boolean {
    return Date.now() > this.#session.user.profile.retrievalDate + DataController.STALE_PERIOD.USER_OBJ;
  }

  get areFollowedArtistsStale(): boolean {
    return Date.now() > this.#session.user.followedArtists.retrievalDate + DataController.STALE_PERIOD.FOLLOWED_ARTISTS;
  }

  get isLastDoneStale(): boolean {
    return !this.#session.user.job.isRunning
      && Date.now() > this.#session.user.job.dateLastDone + DataController.STALE_PERIOD.LAST_DONE;
  }

  /**
   * Updates the access token and the session cookie's `maxAge` property
   * according to the latest data by the Spotify fetcher. The cookie is to
   * be stored in the browser for up to 10 days. The counter restarts whenever
   * the token is refreshed. **This does not invoke a manual session save.**
   */
  updateAccessToken(): void {
    const token = this.#api.tokenInfo;
    const remainingTime = token.expiresAt - Date.now();
    this.#session.cookie.maxAge = remainingTime + ONE_DAY * 10;
  }

  async getUserProfile(): Promise<Result<Readonly<UserProfileInfo>, SpotifyAPIError>> {
    if (!this.isUserObjectStale) {
      console.log('Retrieving user profile from the session CACHE...');
      return {
        ok: true,
        value: this.#session.user.profile,
      };
    }

    console.log('Retrieving user profile from Spotify API...');
    const partial = await this.#api.fetchUserProfile();
    this.updateAccessToken();
    if (!partial.ok)
      return partial;

    const { value: user } = partial;
    this.#session.user._id = user._id;
    this.#session.user.profile = user.profile;
    await Promise.all([
      this.#saveSession(),
      Cache.updateUserProfile(this.#session.user),
    ]);
    return {
      ok: partial.ok,
      value: this.#session.user.profile,
    };
  }

  async *getFollowedArtistsIDs(): AsyncGenerator<string[], SpotifyAPIError|undefined> {
    const { user } = this.#session;
    if (!this.areFollowedArtistsStale) {
      console.log('Retrieving followed artist IDs from the session CACHE...');
      yield user.followedArtists.ids;
      return;
    }

    console.log('Retrieving followed artist IDs from the Spotify API...');

    const iterator = this.#api.fetchFollowedArtists(user.followedArtists.etag);
    const ids: string[] = [];
    let error: SpotifyAPIError|undefined;
    while (true) {
      const result = await iterator.next();
      this.updateAccessToken();
      assert(typeof result.done !== 'undefined');

      if (result.done) {
        error = result.value;
        break;
      }

      console.log('One batch of followed artist IDs successfully pulled.');
      const { resource, etag } = result.value;
      if (resource) {
        const idsBatch = resource.map(artist => artist._id);
        ids.splice(ids.length, 0, ...idsBatch);
        user.followedArtists = {
          ids,
          etag,
          retrievalDate: Date.now(),
        };

        await Promise.all([
          this.#saveSession(),
          Cache.upsertManyArtistObjects(resource),
          Cache.updateFollowedArtistsByUserObject(user),
        ]);
        yield idsBatch;
      } else
        yield this.#session.user.followedArtists.ids;
    }

    return error;
  }

  async getSeveralArtists(ids: string[]): Promise<ArtistsRetrieval> {
    const existingArtists = await Cache.retrieveArtists(ids);
    const existingIDs = existingArtists.map(artist => artist._id);
    console.log(`Found ${existingIDs.length} existing artists in the CACHE.`);

    // TODO: Optimize this to be more efficient
    // Find the difference between known IDs and new IDs
    const unknownIDs = ids.filter(id => !existingIDs.includes(id));
    console.log(`Now retrieving ${unknownIDs.length} artists from the Spotify API...`);

    // Fetch the unknown artists
    const errors: SpotifyAPIError[] = [];
    const artistsResults = await this.#api.fetchSeveralArtists(unknownIDs);
    for (const result of artistsResults) {
      if (!result.ok) {
        errors.push(result.error);
        continue;
      }
      existingArtists.splice(existingArtists.length, 0, ...result.value);
    }

    await this.#saveSession();
    return {
      artists: existingArtists,
      errors,
    };
  }

  async *getReleases(limit = 0): AsyncGenerator<ReleasesRetrieval, SpotifyAPIError[]> {
    const profileResult = await this.getUserProfile();
    if (!profileResult.ok)
      return [ profileResult.error ];
    const { country } = profileResult.value;
    const { user } = this.#session;

    const fetchErrors: SpotifyAPIError[] = [];
    const artistIDsIterator = this.getFollowedArtistsIDs();
    while (true) {
      const artistIDsResult = await artistIDsIterator.next();
      assert(typeof artistIDsResult.done !== 'undefined');

      if (artistIDsResult.done) {
        const artistIDsError = artistIDsResult.value;
        if (artistIDsError)
          fetchErrors.push(artistIDsError);
        break;
      }

      const artistIDs = artistIDsResult.value;
      if (!this.isLastDoneStale) {
        console.log(`Retrieving the releases of ${artistIDs.length} artists from the database CACHE...`);
        yield {
          releases: await Cache.retrieveReleasesFromArtists(artistIDs, country, limit),
          errors: [],
        };
        break;
      }

      // Officially begin a new job
      console.log(`Beginning new job for ${user.profile.name.toUpperCase()}...`);
      user.job.isRunning = true;
      await Promise.all([
        this.#saveSession(),
        Cache.updateJobStatusForUser(user),
      ]);

      // TODO: Optimize this by batching together multiple batches of followed artists
      // Retrieve followed artists, even those who do not exist from the cache yet
      const { artists, errors } = await this.getSeveralArtists(artistIDs);
      fetchErrors.splice(fetchErrors.length, 0, ...errors);

      // Segregate the stale artist objects
      const staleArtists = artists
        .filter(artist => Date.now() > artist.retrievalDate + DataController.STALE_PERIOD.ARTIST_OBJ);
      console.log(`${staleArtists.length} followed artists are considered stale, thus requiring an equal number of fetches.`);

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
              releasesError = releasesResult.value;
              break;
            }

            // TODO: For v1.0, make sure to query for other featured artists
            // who are not necessarily followed by the current user

            pendingOperations.push(Cache.upsertManyReleaseObjects(releasesResult.value));
            console.log(`Fetched ${releasesResult.value.length} releases from ${artist.name}.`);
          }

          await Promise.all(pendingOperations);
          artist.retrievalDate = Date.now();
          return releasesError ?? artist;
        });

      const settledFetches = await Promise.all(releaseFetches);
      this.updateAccessToken();
      console.log('All fetches settled.');

      // Segregate successful fetches
      const fetchResults = settledFetches
        .reduce((prev, curr) => {
          if (curr instanceof SpotifyAPIError)
            prev.errors.push(curr);
          else
            prev.artists.push(curr);
          return prev;
        }, { artists: [] as ArtistObject[], errors: [] as SpotifyAPIError[] });

      // Save all artists to the database cache
      await Cache.upsertManyArtistObjects(fetchResults.artists);

      yield {
        releases: await Cache.retrieveReleasesFromArtists(artistIDs, country, -limit),
        errors: fetchResults.errors,
      };
    }

    user.job = {
      isRunning: false,
      dateLastDone: fetchErrors.length < 1 ? Date.now() : user.job.dateLastDone,
    };
    await Cache.updateJobStatusForUser(this.#session.user);
    return fetchErrors;
  }
}
