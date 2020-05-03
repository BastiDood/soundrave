// NATIVE IMPORTS
import assert from 'assert';

// CACHE
import { Cache } from '../db/Cache';
import { SpotifyAPI } from '../fetchers/Eager.';

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
  #id: string;
  #api: SpotifyAPI;

  constructor(id: string, api: SpotifyAPI) {
    this.#id = id;
    this.#api = api;
  }

  get isUserObjectStale(): boolean {
    const { user } = this.#sessionCache;
    assert(user);
    return Date.now() > user.retrievalDate + DataController.STALE_PERIOD.USER_OBJ;
  }

  get areFollowedArtistsStale(): boolean {
    const { followedArtists } = this.#sessionCache;
    assert(followedArtists);
    return Date.now() > followedArtists.retrievalDate + DataController.STALE_PERIOD.FOLLOWED_ARTISTS;
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

  async getReleases(): Promise<{
    releases: PopulatedReleaseObject[];
    errors: SpotifyAPIError[];
  }> {
    const errors: SpotifyAPIError[] = [];

    // Abort further execution if the user does not exist
    const userResult = await this.getUserProfile();
    if (!userResult.ok)
      return {
        releases: [],
        errors: [ userResult.error ],
      };
    const { value: user } = userResult;

    // Silently consume errors in order to be bubbled
    const followedArtists = await this.getFollowedArtists();
    if (followedArtists.error)
      errors.push(followedArtists.error);

    // Segragate the followed artists whether they have been queried recently
    const { artists } = followedArtists;
    const staleArtists = artists
      .filter(artist => Date.now() > artist.retrievalDate + DataController.STALE_PERIOD.ARTIST_OBJ);

    if (this.#api.isExpired)
      await this.#api.refreshAccessToken();

    // Fetch the releases that have become stale
    const pendingFetches = staleArtists.map(async artist => {
      const pendingOperations: Promise<void>[] = [];
      const releases = this.#api.fetchReleasesByArtistID(artist._id, user.country);
      for await (const batch of releases) {
        // TODO: Somehow handle any errors
        assert(batch.ok);
        const operation = Cache.upsertManyReleaseObjects(batch.value);
        pendingOperations.push(operation);
      }
      await Promise.all(pendingOperations);
      artist.retrievalDate = Date.now();
      return artist;
    });
    const updatedArtists = await Promise.all(pendingFetches);
    await Cache.updateManyRetrievalDatesForArtists(updatedArtists);

    // Retrieve all releases from the database,
    // assuming that every artist has been fetched
    const ids = artists.map(artist => artist._id);
    return {
      releases: await Cache.retrieveReleasesFromArtists(ids, user.country),
      errors,
    };
  }
}
