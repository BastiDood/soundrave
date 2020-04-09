// CACHE
import { Cache } from '../db/Cache';
import { SpotifyAPI } from '../fetchers/Spotify';

// GLOBAL VARIABLES
const THREE_DAYS = 3 * 24 * 60 * 60 * 1e3;

// TODO: Create caching policy for release objects
export class DataRetriever {
  private static readonly STALE_PERIOD = THREE_DAYS;

  #api: SpotifyAPI;
  #followedArtists: FollowedArtistsCache

  constructor(api: SpotifyAPI, followedArtists: FollowedArtistsCache) {
    this.#api = api;
    this.#followedArtists = followedArtists;
  }

  get releases(): Promise<PopulatedReleaseObject[]> {
    return this.followedArtists
      .then(artists => Cache.retrieveReleasesFromArtists(artists.map(artist => artist._id), this.#api.applicableCountry));
  }

  get isStale(): boolean {
    return Date.now() > this.#followedArtists.retrievalDate + DataRetriever.STALE_PERIOD;
  }

  get followedArtists(): Promise<ArtistObject[]> {
    // Return from cache if it is still warm
    if (!this.isStale)
      return Cache.retrieveArtists(this.#followedArtists.ids);

    return (async (): Promise<ArtistObject[]> => {
      // Fetch data from Spotify API
      const artists = await this.#api.fetchFollowedArtists();

      // Write updated artist data to database cache
      await Promise.all(artists.map(Cache.writeArtistObject.bind(Cache)));

      // Finish operation by updating the retrieval date of the cache
      this.#followedArtists.retrievalDate = Date.now();

      return artists;
    })();
  }

  get followedArtistsCache(): FollowedArtistsCache { return { ...this.#followedArtists }; }
  get tokenCache(): SpotifyAccessToken { return this.#api.tokenInfo; }
}
