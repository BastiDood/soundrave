// NODE CORE IMPORTS
import assert from 'assert';

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
  };

  /** Spotify ID of the current user */
  #user: UserObject;
  #api: SpotifyAPI;

  constructor(token: SpotifyAccessToken, user: UserObject) {
    this.#user = user;
    this.#api = SpotifyAPI.restore(token);
  }

  get isUserObjectStale(): boolean {
    return Date.now() > this.#user.retrievalDate + DataController.STALE_PERIOD.USER_OBJ;
  }

  get areFollowedArtistsStale(): boolean {
    return Date.now() > this.#user.followedArtists.retrievalDate + DataController.STALE_PERIOD.FOLLOWED_ARTISTS;
  }

  async getUserProfile(): Promise<Result<Omit<UserObject, 'followedArtists'>, SpotifyAPIError>> {
    if (this.#api.isExpired)
      await this.#api.refreshAccessToken();

    if (!this.isUserObjectStale) {
      const profile = { ...this.#user };
      delete profile.followedArtists;
      return {
        ok: true,
        value: profile,
      };
    }

    const partial = await this.#api.fetchUserProfile();
    if (!partial.ok)
      return partial;

    this.#user = {
      ...this.#user,
      ...partial.value,
      retrievalDate: Date.now(),
    };

    await Cache.upsertUserObject(this.#user);
    const value = { ...this.#user };
    delete value.followedArtists;
    return {
      ok: partial.ok,
      value,
    };
  }

  // TODO: Correct types for asynchronous iterables
  async *getFollowedArtistsIDs(): AsyncGenerator<string[], SpotifyAPIError|undefined> {
    if (!this.areFollowedArtistsStale) {
      yield this.#user.followedArtists.ids;
      return;
    }

    if (this.#api.isExpired)
      await this.#api.refreshAccessToken();

    const iterator = this.#api.fetchFollowedArtists(this.#user.followedArtists.etag);
    let done = false;
    do {
      const result = await iterator.next();
      assert(typeof result.done !== 'undefined');

      if (result.done)
        return result.value;

      const { resource, etag } = result.value;
      if (resource) {
        const pendingOperations: Promise<void>[] = [];
        pendingOperations.push(Cache.upsertManyArtistObjects(resource));

        const ids = resource.map(artist => artist._id);
        this.#user.followedArtists = {
          ids,
          etag,
          retrievalDate: Date.now(),
        };
        pendingOperations.push(Cache.upsertUserObject(this.#user));

        yield ids;
        await Promise.all(pendingOperations);
      } else
        yield this.#user.followedArtists.ids;

      done = result.done;
    } while (!done);

    return;
  }

  async *getReleases(): AsyncGenerator<Result<PopulatedReleaseObject[], SpotifyAPIError>> {
    const artistIDs = this.getFollowedArtistsIDs();
    // TODO: Create asynchronous implementation
  }
}
