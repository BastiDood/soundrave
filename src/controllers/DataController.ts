// NODE CORE IMPORTS
import { promisify } from 'util';
import { strict as assert } from 'assert';

// FETCHERS
import { SpotifyAPI } from '../fetchers/Spotify';

// CACHE
import { Cache } from '../db/Cache';

// ERRORS
import type { SpotifyAPIError } from '../errors/SpotifyAPIError';

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
  /** Represents the current Spotify user */
  #user: UserObject;
  /** Handler for all API fetches */
  #api: SpotifyAPI;
  /** Utility function for manually saving the current session */
  #saveSession: () => Promise<void>;

  constructor(session: Express.Session, user: UserObject) {
    this.#session = session;
    this.#user = user;
    this.#api = SpotifyAPI.restore(this.#session.token.spotify);
    this.#saveSession = promisify(this.#session.save.bind(this.#session));
  }

  get isUserObjectStale(): boolean {
    return Date.now() > this.#user.profile.retrievalDate + DataController.STALE_PERIOD.USER_OBJ;
  }

  get areFollowedArtistsStale(): boolean {
    return Date.now() > this.#user.followedArtists.retrievalDate + DataController.STALE_PERIOD.FOLLOWED_ARTISTS;
  }

  get isLastDoneStale(): boolean {
    return !this.#user.job.isRunning
      && Date.now() > this.#user.job.dateLastDone + DataController.STALE_PERIOD.LAST_DONE;
  }

  /**
   * Updates the access token and the session cookie's `maxAge` property
   * according to the latest data by the Spotify fetcher.
   */
  updateAccessToken(): Promise<void> {
    const token = this.#api.tokenInfo;
    const remainingTime = token.expiresAt - Date.now();
    this.#session.cookie.maxAge = remainingTime + ONE_DAY * 10;
    return this.#saveSession();
  }

  async getUserProfile(): Promise<Result<Readonly<Pick<UserObject, '_id'|'profile'>>, SpotifyAPIError>> {
    if (!this.isUserObjectStale)
      return {
        ok: true,
        value: this.#user,
      };

    const partial = await this.#api.fetchUserProfile();
    await this.updateAccessToken();
    if (!partial.ok)
      return partial;

    const { value: user } = partial;
    this.#user._id = user._id;
    this.#user.profile = user.profile;
    await Cache.upsertUserObject(this.#user);
    return {
      ok: partial.ok,
      value: this.#user,
    };
  }

  async *getFollowedArtists(): AsyncGenerator<ArtistObject[], SpotifyAPIError|undefined> {
    if (!this.areFollowedArtistsStale) {
      yield await Cache.retrieveArtists(this.#user.followedArtists.ids);
      return;
    }

    const iterator = this.#api.fetchFollowedArtists(this.#user.followedArtists.etag);
    let done = false;
    let error: SpotifyAPIError|undefined;
    while (!done) {
      const result = await iterator.next();
      await this.updateAccessToken();
      assert(typeof result.done !== 'undefined');

      if (result.done) {
        error = result.value;
        break;
      }

      const { resource, etag } = result.value;
      if (resource) {
        this.#user.followedArtists = {
          ids: this.#user.followedArtists.ids.concat(resource.map(artist => artist._id)),
          etag,
          retrievalDate: Date.now(),
        };

        await Promise.all([
          Cache.upsertManyArtistObjects(resource),
          Cache.updateFollowedArtistsByUserObject(this.#user),
        ]);
        yield resource;
      } else
        yield await Cache.retrieveArtists(this.#user.followedArtists.ids);

      done = result.done;
    }

    return error;
  }

  async *getReleases(limit = 0): AsyncGenerator<ReleaseRetrieval, SpotifyAPIError|undefined> {
    if (!this.isLastDoneStale) {
      const { ids } = this.#user.followedArtists;
      const { country } = this.#user.profile;
      yield {
        releases: await Cache.retrieveReleasesFromArtists(ids, country, limit),
        errors: [],
      };
      return;
    }

    const userResult = await this.getUserProfile();
    if (!userResult.ok)
      return userResult.error;
    const { country } = userResult.value.profile;

    // Officially begin a new job
    this.#user.job.isRunning = true;
    await Cache.updateJobStatusForUser(this.#user);

    const iterator = this.getFollowedArtists();
    let done = false;
    let error: SpotifyAPIError|undefined;
    while (!done) {
      const followedResult = await iterator.next();
      assert(typeof followedResult.done !== 'undefined');

      if (followedResult.done) {
        error = followedResult.value;
        break;
      }

      // Segregate fresh and stale artist objects
      const releaseFetches = followedResult.value
        .filter(artist => artist.retrievalDate > Date.now() + DataController.STALE_PERIOD.ARTIST_OBJ)
        .map(async ({ _id }): Promise<SpotifyAPIError|undefined> => {
          const pendingOperations: Promise<void>[] = [];
          const releaseIterator = this.#api.fetchReleasesByArtistID(_id);
          let fetchDone = false;
          let releasesError: SpotifyAPIError|undefined;
          while (!fetchDone) {
            const releasesResult = await releaseIterator.next();
            await this.updateAccessToken();
            assert(typeof releasesResult.done !== 'undefined');

            if (releasesResult.done) {
              releasesError = releasesResult.value;
              break;
            }

            // TODO: For v1.0, make sure to query for other featured artists
            // who are not necessarily followed by the current user

            pendingOperations.push(Cache.upsertManyReleaseObjects(releasesResult.value));
            fetchDone = releasesResult.done;
          }

          await Promise.all(pendingOperations);
          return releasesError;
        });

      const settledFetches = await Promise.all(releaseFetches);
      const ids = followedResult.value.map(artist => artist._id);
      yield {
        releases: await Cache.retrieveReleasesFromArtists(ids, country, -limit),
        errors: settledFetches.filter(Boolean) as SpotifyAPIError[],
      };

      done = followedResult.done;
    }

    this.#user.job = {
      isRunning: false,
      dateLastDone: Date.now(),
    };
    await Cache.updateJobStatusForUser(this.#user);
    return error;
  }
}
