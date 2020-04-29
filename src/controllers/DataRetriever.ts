// CACHE
import { Cache } from '../db/Cache';
import { SpotifyAPI } from '../fetchers/Spotify';

// ERRORS
import { SpotifyAPIError } from '../errors/SpotifyAPIError';

// GLOBAL VARIABLES
const THREE_DAYS = 3 * 24 * 60 * 60 * 1e3;
// const ONE_WEEK = ???;

// TODO: Create caching policy for release objects
export class DataRetriever {
  private static readonly STALE_PERIOD = {
    FOLLOWED_ARTISTS: THREE_DAYS,
    // ARTIST_OBJ: ONE_WEEK
  };

  #api: SpotifyAPI;
  #sessionCache: Required<SessionCache>;

  /**
   * Note that the parameters take in the objects by **reference**.
   * Any mutation done on this class' fields **will** reflect on the session.
   */
  constructor(api: SpotifyAPI, sessionCache: Required<SessionCache>) {
    this.#api = api;
    this.#sessionCache = sessionCache;
  }

  get areFollowedArtistsStale(): boolean {
    return Date.now() > this.#sessionCache.followedArtists.retrievalDate + DataRetriever.STALE_PERIOD.FOLLOWED_ARTISTS;
  }

  async getFollowedArtists(): Promise<{
    artists: ArtistObject[];
    error?: SpotifyAPIError;
  }> {
    if (!this.areFollowedArtistsStale)
      return {
        artists: await Cache.retrieveArtists(this.#sessionCache.followedArtists.ids),
      };

    if (this.#api.isExpired)
      await this.#api.refreshAccessToken();

    // Concurrently fetch data from Spotify API
    const pendingOperations: Promise<void>[] = [];
    let artists: ArtistObject[] = [];
    for await (const result of this.#api.fetchFollowedArtists()) {
      // Keep track of all errors coming in
      if (!result.ok)
        return {
          artists,
          error: result.error,
        };

      // Write updated artist data to database cache
      const operation = Cache.upsertManyArtistObjects(result.value);
      pendingOperations.push(operation);
      artists = artists.concat(result.value);
    }

    // Finish operation by updating the session
    this.#sessionCache.followedArtists.ids = artists.map(artist => artist._id);
    this.#sessionCache.followedArtists.retrievalDate = Date.now();

    await Promise.all(pendingOperations);

    return { artists };
  }

  async getReleases(): Promise<PopulatedReleaseObject[]> {
    // TODO: Check to see if any of the artists are not in the database

    const { country } = this.#sessionCache.user;

    if (!this.areFollowedArtistsStale) {
      const ids = this.#sessionCache.followedArtists.ids;
      return Cache.retrieveReleasesFromArtists(ids, country);
    }

    if (this.#api.isExpired)
      await this.#api.refreshAccessToken();

    // TODO: Add a `lastRetrieved` field for each artist to figure
    // out which among them have to be fetched
    const { artists } = await this.getFollowedArtists();
    const ids = artists.map(artist => artist._id);

    // TODO: Fetch from API instead
    return Cache.retrieveReleasesFromArtists(ids, country);
  }
}
