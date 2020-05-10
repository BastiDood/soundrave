// NODE CORE IMPORTS
import { strict as assert } from 'assert';

// FETCHERS
import { SpotifyAPI } from '../fetchers/Spotify';

// CACHE
import { Cache } from '../db/Cache';

// ERRORS
import type { SpotifyAPIError } from '../errors/SpotifyAPIError';

// TYPES
import type { ReleaseRetrieval } from '../../typings/global';

// GLOBAL VARIABLES
const ONE_DAY = 24 * 60 * 60 * 1e3;

export class DataController {
  private static readonly STALE_PERIOD = {
    FOLLOWED_ARTISTS: ONE_DAY * 3,
    USER_OBJ: ONE_DAY * 7,
    ARTIST_OBJ: ONE_DAY * 4,
    LAST_DONE: ONE_DAY * 5,
  };

  /** Spotify ID of the current user */
  #user: UserObject;
  #api: SpotifyAPI;

  constructor(token: SpotifyAccessToken, user: UserObject) {
    this.#user = user;
    this.#api = SpotifyAPI.restore(token);
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

  async getUserProfile(): Promise<Result<Readonly<Pick<UserObject, '_id'|'profile'>>, SpotifyAPIError>> {
    if (!this.isUserObjectStale)
      return {
        ok: true,
        value: this.#user,
      };

    const partial = await this.#api.fetchUserProfile();
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

  async *getFollowedArtistsIDs(): AsyncGenerator<ArtistObject[], SpotifyAPIError|undefined> {
    if (!this.areFollowedArtistsStale) {
      yield await Cache.retrieveArtists(this.#user.followedArtists.ids);
      return;
    }

    const iterator = this.#api.fetchFollowedArtists(this.#user.followedArtists.etag);
    let done = false;
    while (!done) {
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
    if (!this.isLastDoneStale) {
      const { ids } = this.#user.followedArtists;
      const { country } = this.#user.profile;
      yield {
        releases: await Cache.retrieveReleasesFromArtists(ids, country),
        errors: [],
      };
      return;
    }

    // Officially begin a new job
    this.#user.job.isRunning = true;

    const userResult = await this.getUserProfile();
    if (!userResult.ok)
      return userResult.error;
    const { country } = userResult.value.profile;

    const iterator = this.getFollowedArtistsIDs();
    let done = false;
    while (!done) {
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

    this.#user.job = {
      isRunning: false,
      dateLastDone: Date.now(),
    };
    await Cache.updateJobStatusForUser(this.#user);
    return;
  }
}
