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

  async getUserProfile(): Promise<Result<Readonly<Omit<UserObject, 'followedArtists'>>, SpotifyAPIError>> {
    if (!this.isUserObjectStale)
      return {
        ok: true,
        value: this.#user,
      };

    if (this.#api.isExpired)
      await this.#api.refreshAccessToken();

    const partial = await this.#api.fetchUserProfile();
    if (!partial.ok)
      return partial;

    this.#user = {
      ...this.#user,
      ...partial.value,
      retrievalDate: Date.now(),
    };

    await Cache.upsertUserObject(this.#user);
    return {
      ok: partial.ok,
      value: this.#user,
    };
  }

  async *getFollowedArtistsIDs(): AsyncGenerator<ArtistObject[], SpotifyAPIError|undefined> {
    if (!this.areFollowedArtistsStale) {
      yield await Cache.retrieveArtists(this.#user.followedArtists.ids);
      return;
    }

    const iterator = this.#api.fetchFollowedArtists(this.#user.followedArtists.etag);
    let done = false;
    while (!done) {
      if (this.#api.isExpired)
        await this.#api.refreshAccessToken();

      const result = await iterator.next();
      assert(typeof result.done !== 'undefined');

      if (result.done)
        return result.value;

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

    return;
  }

  async *getReleases(): AsyncGenerator<ReleaseRetrieval, SpotifyAPIError|undefined> {
    const userResult = await this.getUserProfile();

    if (!userResult.ok)
      return userResult.error;

    const { country } = userResult.value;

    const iterator = this.getFollowedArtistsIDs();
    let done = false;
    while (!done) {
      if (this.#api.isExpired)
        await this.#api.refreshAccessToken();

      const followedResult = await iterator.next();
      assert(typeof followedResult.done !== 'undefined');

      if (followedResult.done)
        return followedResult.value;

      // Segregate fresh and stale artist objects
      const releaseFetches = followedResult.value
        .filter(artist => artist.retrievalDate > Date.now() + DataController.STALE_PERIOD.ARTIST_OBJ)
        .map(async ({ _id }) => {
          const pendingOperations: Promise<void>[] = [];
          const releaseIterator = this.#api.fetchReleasesByArtistID(_id, country);
          let fetchDone = false;
          while (!fetchDone) {
            if (this.#api.isExpired)
              await this.#api.refreshAccessToken();

            const releasesResult = await releaseIterator.next();
            assert(typeof releasesResult.done !== 'undefined');

            if (releasesResult.done)
              return releasesResult.value;

            // TODO: For v1.0, make sure to query for other featured artists
            // who are not necessarily followed by the current user

            pendingOperations.push(Cache.upsertManyReleaseObjects(releasesResult.value));
            fetchDone = releasesResult.done;
          }

          await Promise.all(pendingOperations);
          return;
        });

      const settledFetches = await Promise.all(releaseFetches);
      const ids = followedResult.value.map(artist => artist._id);
      yield {
        releases: await Cache.retrieveReleasesFromArtists(ids, country),
        errors: settledFetches.filter(Boolean) as SpotifyAPIError[],
      };

      done = followedResult.done;
    }

    return;
  }
}
