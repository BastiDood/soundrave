// CACHE
import { Cache } from '../db/Cache';
import { SpotifyAPI } from '../fetchers/Spotify';

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
  }> {
    // Return from cache if it is still warm
    if (!this.isStale)
      return {
        artists: await Cache.retrieveArtists(this.#sessionCache.followedArtists.ids),
        retrievalDate: this.#sessionCache.followedArtists.retrievalDate,
      };

    // Fetch data from Spotify API
    const artists = await this.#api.fetchFollowedArtists();

    // Write updated artist data to database cache
    await Promise.all(artists.map(Cache.writeArtistObject.bind(Cache)));

    // Finish operation by updating the retrieval date of the cache
    const retrievalDate = Date.now();
    this.#sessionCache.followedArtists.retrievalDate = retrievalDate;

    return { artists, retrievalDate };
  }

  async getFollowedArtistIDs(): Promise<{
    ids: string[];
    retrievalDate: number;
  }> {
    // Return from cache if it is still warm
    if (!this.isStale)
      return {
        ids: this.#sessionCache.followedArtists.ids,
        retrievalDate: this.#sessionCache.followedArtists.retrievalDate,
      };

    // Fetch data from Spotify API
    const artists = await this.#api.fetchFollowedArtists();

    // Write updated artist data to database cache
    await Promise.all(artists.map(Cache.writeArtistObject.bind(Cache)));

    // Finish operation by updating the retrieval date of the cache
    const ids = artists.map(artist => artist._id);
    const retrievalDate = Date.now();
    this.#sessionCache.followedArtists.retrievalDate = retrievalDate;

    return { ids, retrievalDate };
  }

  async getReleases(): Promise<PopulatedReleaseObject[]> {
    // TODO: Fetch from API if needed
    // TODO: Check to see if any of the artists are not in the database
    const { artists } = await this.getFollowedArtists();
    const ids = artists.map(artist => artist._id);
    return Cache.retrieveReleasesFromArtists(ids, this.#sessionCache.user.country);
  }
}
