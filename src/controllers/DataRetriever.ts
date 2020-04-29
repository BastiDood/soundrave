// NATIVE IMPORTS
import assert from 'assert';

// CACHE
import { Cache } from '../db/Cache';
import { SpotifyAPI } from '../fetchers/Spotify';

// ERRORS
import { SpotifyAPIError } from '../errors/SpotifyAPIError';

// GLOBAL VARIABLES
const ONE_DAY = 24 * 60 * 60 * 1e3;

// TODO: Create caching policy for release objects
export class DataRetriever {
  private static readonly STALE_PERIOD = {
    FOLLOWED_ARTISTS: ONE_DAY * 3,
    USER_OBJ: ONE_DAY * 7,
    ARTIST_OBJ: ONE_DAY * 4,
  };

  #api: SpotifyAPI;
  #sessionCache: SessionCache;

  /**
   * Note that the parameters take in the objects by **reference**.
   * Any mutation done on this class' fields **will** reflect on the session.
   */
  constructor(api: SpotifyAPI, sessionCache: SessionCache) {
    this.#api = api;
    this.#sessionCache = sessionCache;
  }

  get isUserObjectStale(): boolean {
    const { user } = this.#sessionCache;
    assert(user);
    return Date.now() > user.retrievalDate + DataRetriever.STALE_PERIOD.USER_OBJ;
  }

  get areFollowedArtistsStale(): boolean {
    const { followedArtists } = this.#sessionCache;
    assert(followedArtists);
    return Date.now() > followedArtists.retrievalDate + DataRetriever.STALE_PERIOD.FOLLOWED_ARTISTS;
  }

  async getUserProfile(): Promise<Result<UserObject, SpotifyAPIError>> {
    if (this.#sessionCache.user && !this.isUserObjectStale)
      return {
        ok: true,
        value: this.#sessionCache.user,
      };

    if (this.#api.isExpired)
      await this.#api.refreshAccessToken();

    const result = await this.#api.fetchUserProfile();

    if (result.ok)
      this.#sessionCache.user = result.value;

    return result;
  }

  async getFollowedArtists(): Promise<{
    artists: ArtistObject[];
    error: SpotifyAPIError|null;
  }> {
    const { followedArtists } = this.#sessionCache;
    let error: SpotifyAPIError|null = null;
    if (followedArtists && !this.areFollowedArtistsStale)
      return {
        artists: await Cache.retrieveArtists(followedArtists.ids),
        error,
      };

    if (this.#api.isExpired)
      await this.#api.refreshAccessToken();

    // Concurrently fetch data from Spotify API
    const pendingOperations: Promise<void>[] = [];
    let artists: ArtistObject[] = [];
    for await (const result of this.#api.fetchFollowedArtists()) {
      // Keep track of all errors coming in
      if (!result.ok) {
        error = result.error;
        break;
      }

      // Write updated artist data to database cache
      const operation = Cache.upsertManyArtistObjects(result.value);
      pendingOperations.push(operation);
      artists = artists.concat(result.value);
    }

    // Finish operation by updating the session
    assert(followedArtists);
    followedArtists.ids = artists.map(artist => artist._id);
    followedArtists.retrievalDate = Date.now();

    await Promise.all(pendingOperations);

    return { artists, error };
  }

  async getReleases(): Promise<PopulatedReleaseObject[]> {
    // TODO: Check to see if any of the artists are not in the database

    const { followedArtists, user } = this.#sessionCache;
    assert(followedArtists);
    assert(user);
    if (!this.areFollowedArtistsStale) {
      const ids = followedArtists.ids;
      return Cache.retrieveReleasesFromArtists(ids, user.country);
    }

    if (this.#api.isExpired)
      await this.#api.refreshAccessToken();

    // TODO: Add a `lastRetrieved` field for each artist to figure
    // out which among them have to be fetched
    const { artists } = await this.getFollowedArtists();
    const ids = artists.map(artist => artist._id);

    // TODO: Fetch from API instead
    return Cache.retrieveReleasesFromArtists(ids, user.country);
  }
}
