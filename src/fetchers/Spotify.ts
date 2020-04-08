// NATIVE IMPORTS
import { posix as path } from 'path';
import { stringify } from 'querystring';
import url from 'url';

// DEPENDENCIES
import fetch from 'node-fetch';

// LOADERS
import { env } from '../loaders/env';

// UTILITY FUNCTIONS
import { subdivideArray } from '../util/subdivideArray';

// TYPE ALIASES
type RequestInit = import('node-fetch').RequestInit;

// Global Variables
const FIVE_MINUTES = 5 * 60 * 1e3;

export class SpotifyAPI {
  static readonly REDIRECT_URI = 'http://localhost/callback';
  static readonly API_VERSION = 'v1';
  static readonly BASE_ENDPOINT = 'https://api.spotify.com';
  static readonly ACCOUNTS_ENDPOINT = 'https://accounts.spotify.com';
  static readonly AUTH_ENDPOINT = SpotifyAPI.formatEndpoint(SpotifyAPI.ACCOUNTS_ENDPOINT, '/authorize', {
    client_id: env.CLIENT_ID,
    response_type: 'code',
    redirect_uri: SpotifyAPI.REDIRECT_URI,
    scope: 'user-follow-read',
  });
  static readonly TOKEN_ENDPOINT = SpotifyAPI.formatEndpoint(SpotifyAPI.ACCOUNTS_ENDPOINT, '/api/token');

  private static transformToArtistObject = (artists: SpotifyApi.ArtistObjectFull[]): ArtistObject[] => artists.map(artist => ({
    _id: artist.id,
    name: artist.name,
    followers: artist.followers.total,
    popularity: artist.popularity,
    images: artist.images,
  }));
  private static failedFetchHandler = ({ status, message }: SpotifyApi.ErrorObject): never => {
    throw new Error(`${status}: ${message}`);
  };

  #token: SpotifyAccessToken;

  constructor(token: SpotifyAccessToken) { this.#token = token; }

  async fetchFollowedArtists(): Promise<ArtistObject[]> {
    if (this.isExpired)
      await this.refreshAccessToken();

    if (!this.#token.scope.includes('user-follow-read'))
      throw new Error('Access token does not have the permission to read list of followers.');

    let followedArtists: ArtistObject[] = [];
    let next = SpotifyAPI.formatEndpoint(SpotifyAPI.BASE_ENDPOINT, '/me/following', {
      type: 'artist',
      limit: '50',
    });

    // Keep retrieving until pagination stops
    while (next) {
      const { artists }: SpotifyApi.UsersFollowedArtistsResponse = await fetch(next, this.fetchOptionsForGet)
        .then(res => res.json())
        .catch(SpotifyAPI.failedFetchHandler);
      const transformedArtistData: ArtistObject[] = SpotifyAPI.transformToArtistObject(artists.items);
      followedArtists = followedArtists.concat(transformedArtistData);
      next = artists.next;
    }

    return followedArtists;
  }

  /**
   * Fetch the API for several artists. This concurrently retrieves
   * the data in batches of `50` (Spotify's maximum limit) in order to
   * minimize the number of actual requests to the API.
   * @param ids - List of Spotify artist IDs
   */
  async fetchSeveralArtists(ids: string[]): Promise<ArtistObject[]> {
    if (this.isExpired)
      await this.refreshAccessToken();

    // Divide the array into sub-arrays with maximum length of 50
    const batches = await Promise.allSettled(
      subdivideArray(ids, 50)
        .map(batch => {
          const endpoint = SpotifyAPI.formatEndpoint(SpotifyAPI.BASE_ENDPOINT, '/artists', {
            ids: batch.join(','),
          });
          return fetch(endpoint, this.fetchOptionsForGet)
            .then(res => res.json() as Promise<SpotifyApi.MultipleArtistsResponse>)
            .catch(SpotifyAPI.failedFetchHandler);
        }),
    );

    let artists: ArtistObject[] = [];
    for (const batch of batches)
      if (batch.status === 'fulfilled') {
        const transformedArtists = SpotifyAPI.transformToArtistObject(batch.value.artists);
        artists = artists.concat(transformedArtists);
      } else {
        // TODO: Properly handle failed requests (i.e. in case of rate-limited)
        // by caching successful requests and throwing failures
        const { message }: SpotifyApi.ErrorObject = batch.reason;
        throw new Error(message);
      }

    return artists;
  }

  /**
   * Get all the releases from a specific artist.
   * @param id - Spotify ID of artist
   */
  async fetchReleasesByArtistID(id: string): Promise<NonPopulatedReleaseObject[]> {
    if (this.isExpired)
      await this.refreshAccessToken();

    const releases: NonPopulatedReleaseObject[] = [];
    let next = SpotifyAPI.formatEndpoint(SpotifyAPI.BASE_ENDPOINT, `/artists/${id}/albums`, {
      include_groups: 'album,single',
      market: this.#token.countryCode,
      limit: '50',
    });

    // Keep retrieving until pagination stops
    while (next) {
      const json: SpotifyApi.ArtistsAlbumsResponse = await fetch(next, this.fetchOptionsForGet)
        .then(res => res.json())
        .catch(SpotifyAPI.failedFetchHandler);

      for (const release of json.items)
        // Only include releases that are available in at least one country
        if (release.available_markets)
          releases.push({
            _id: release.id,
            title: release.name,
            albumType: release.album_type as 'album'|'single'|'compilation',
            releaseDate: Number(Date.parse(release.release_date)),
            datePrecision: release.release_date_precision as 'year'|'month'|'day',
            availableCountries: release.available_markets,
            images: release.images,
            artists: release.artists.map(artist => artist.id),
          });

      next = json.next;
    }

    return releases;
  }

  /**
   * Utility function for exchanging an authorization code for
   * an access token.
   * @param code - Valid authorization code sent to the callback URI
   */
  static async exchangeCodeForAccessToken(code: string): Promise<OAuthToken> {
    const token = await fetch(SpotifyAPI.TOKEN_ENDPOINT, {
      method: 'POST',
      body: new url.URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: SpotifyAPI.REDIRECT_URI,
        client_id: env.CLIENT_ID,
        client_secret: env.CLIENT_SECRET,
      }),
    })
      .then(res => res.json() as Promise<OAuthToken>)
      .catch(SpotifyAPI.failedFetchHandler);
    return token;
  }

  /**
   * Format a full URL to the Spotify API given an endpoint and
   * some query parameters.
   * @param endpoint - Spotify endpoint to be accessed
   * @param query - Record representing the query parameters of the request
   */
  private static formatEndpoint(base: string, endpoint: string, query?: Record<string, string>): string {
    const relative = path.join(SpotifyAPI.API_VERSION, endpoint);
    const queryStr = stringify(query);
    return url.resolve(base, relative) + (queryStr ? `?${queryStr}` : '');
  }

  /** Refresh the token associated with this instance. */
  private async refreshAccessToken(): Promise<SpotifyAccessToken> {
    // Retrieve new access token
    const credentials = Buffer.from(`${env.CLIENT_ID}:${env.CLIENT_SECRET}`).toString('base64');
    const newToken: OAuthToken = await fetch(SpotifyAPI.TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Basic ${credentials}` },
      body: new url.URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.#token.refreshToken,
      }),
    })
      .then(res => res.json())
      .catch(SpotifyAPI.failedFetchHandler);

    // Update token
    this.#token.accessToken = newToken.access_token;
    this.#token.scope = newToken.scope;
    this.#token.expiresAt = Date.now() + newToken.expires_in * 1e3;

    // Use spread operator in order to clone the object
    return { ...this.#token };
  }

  /**
   * Consider tokens that are 5 minutes to expiry as "expired"
   * and thus eligible to be refreshed.
   */
  get isExpired(): boolean { return Date.now() > this.#token.expiresAt - FIVE_MINUTES; }

  get fetchOptionsForGet(): RequestInit {
    return {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.#token.accessToken}` },
    };
  }
}
