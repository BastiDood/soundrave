// CACHE
import { Cache } from '../db/Cache';
import { SpotifyAPI } from '../fetchers/Spotify';

// ERRORS
import { SpotifyAPIError } from '../errors/SpotifyAPIError';

// GLOBAL VARIABLES
const THREE_DAYS = 3 * 24 * 60 * 60 * 1e3;

// TODO: Create caching policy for release objects
export class DataRetriever {
  private static readonly STALE_PERIOD = THREE_DAYS;

  #api: SpotifyAPI;
  #sessionCache: Required<SessionCache>;

  constructor(api: SpotifyAPI, sessionCache: Required<SessionCache>) {
    this.#api = api;
    this.#sessionCache = sessionCache;
  }

  get isStale(): boolean {
    return Date.now() > this.#sessionCache.followedArtists.retrievalDate + DataRetriever.STALE_PERIOD;
  }

  async getFollowedArtists(): Promise<{
    artists: ArtistObject[];
    retrievalDate: number;
    error?: SpotifyAPIError;
  }> {
    // Return from cache if it is still warm
    if (!this.isStale)
      return {
        artists: await Cache.retrieveArtists(this.#sessionCache.followedArtists.ids),
        retrievalDate: this.#sessionCache.followedArtists.retrievalDate,
      };

    // Concurrently fetch data from Spotify API
    let artists: ArtistObject[] = [];
    for await (const result of this.#api.fetchFollowedArtists()) {
      // Keep track of all errors coming in
      if (!result.ok)
        return {
          artists,
          retrievalDate: Date.now(),
          error: result.error,
        };

      // Write updated artist data to database cache
      const cacheToDatabase = Cache.writeArtistObject.bind(Cache);
      await Promise.all(result.value.map(cacheToDatabase));
      artists = artists.concat(result.value);
    }

    // Finish operation by updating the retrieval date of the cache
    const retrievalDate = Date.now();
    const ids = artists.map(artist => artist._id);
    this.#sessionCache.followedArtists.ids = ids;
    this.#sessionCache.followedArtists.retrievalDate = retrievalDate;

    return { artists, retrievalDate };
  }

  async getFollowedArtistIDs(): Promise<{
    ids: string[];
    retrievalDate: number;
    error?: SpotifyAPIError;
  }> {
    // Return from cache if it is still warm
    if (!this.isStale)
      return {
        ids: this.#sessionCache.followedArtists.ids,
        retrievalDate: this.#sessionCache.followedArtists.retrievalDate,
      };

    // Concurrently fetch data from Spotify API
    const pendingOperations: Promise<void[]>[] = [];
    let artists: ArtistObject[] = [];
    for await (const result of this.#api.fetchFollowedArtists()) {
      // Keep track of all errors coming in
      if (!result.ok)
        return {
          ids: artists.map(artist => artist._id),
          retrievalDate: Date.now(),
          error: result.error,
        };

      // Write updated artist data to database cache
      const cacheToDatabase = Cache.writeArtistObject.bind(Cache);
      const operation = Promise.all(result.value.map(cacheToDatabase));
      pendingOperations.push(operation);
      artists = artists.concat(result.value);
    }

    await Promise.all(pendingOperations);

    // Finish operation by updating the retrieval date of the cache
    const retrievalDate = Date.now();
    const ids = artists.map(artist => artist._id);
    this.#sessionCache.followedArtists.ids = ids;
    this.#sessionCache.followedArtists.retrievalDate = retrievalDate;

    return { ids, retrievalDate };
  }

  async getReleases(): Promise<PopulatedReleaseObject[]> {
    // TODO: Check to see if any of the artists are not in the database

    const { country } = this.#sessionCache.user;

    if (!this.isStale) {
      const ids = this.#sessionCache.followedArtists.ids;
      return Cache.retrieveReleasesFromArtists(ids, country);
    }

    const { artists } = await this.getFollowedArtists();
    const ids = artists.map(artist => artist._id);

    // TODO: Fetch from API if needed
    return Cache.retrieveReleasesFromArtists(ids, country);
  }
}
