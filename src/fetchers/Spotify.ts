// NATIVE IMPORTS
import { posix as path } from 'path';
import { stringify } from 'querystring';
import url from 'url';

// DEPENDENCIES
import fetch from 'node-fetch';

// LOADERS
import { env } from '../loaders/env';

// TYPE ALIASES
type RequestInit = import('node-fetch').RequestInit;

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

  private static failedFetchHandler = (err: SpotifyApi.ErrorObject): never => { throw new Error(err.message); }
  #token: SpotifyAccessToken;

  constructor(token: SpotifyAccessToken) { this.#token = token; }

  /** Refresh the token associated with this instance. */
  async refreshAccessToken(): Promise<SpotifyAccessToken> {
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
      const transformedArtistData: ArtistObject[] = artists.items
        .map(artist => ({
          _id: artist.id,
          name: artist.name,
          followers: artist.followers.total,
          popularity: artist.popularity,
          images: artist.images,
        }));
      followedArtists = followedArtists.concat(transformedArtistData);
      next = artists.next;
    }

    return followedArtists;
  }

  /**
   * Get all the releases from a specific artist.
   * @param id - Spotify ID of artist
   */
  async fetchReleasesByArtistID(id: string): Promise<NonPopulatedReleaseObject[]> {
    if (this.isExpired)
      await this.refreshAccessToken();

    let releases: NonPopulatedReleaseObject[] = [];
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
      const transformedReleaseData: NonPopulatedReleaseObject[] = json.items
        .map(release => ({
          _id: release.id,
          title: release.name,
          albumType: release.album_type as 'album'|'single'|'compilation',
          releaseDate: Number(Date.parse(release.release_date)),
          datePrecision: release.release_date_precision as 'year'|'month'|'day',
          availableCountries: release.available_markets!,
          images: release.images,
          artists: release.artists.map(artist => artist.id),
        }));
      releases = releases.concat(transformedReleaseData);
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

  get isExpired(): boolean { return Date.now() > this.#token.expiresAt; }

  get fetchOptionsForGet(): RequestInit {
    return {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.#token.accessToken}` },
    };
  }
}
