// NATIVE IMPORTS
import { URLSearchParams } from 'url';

// DEPENDENCIES
import fetch from 'node-fetch';

// LOADERS
import { env } from '../loaders/env';

// UTILITY FUNCTIONS
import { formatEndpoint, subdivideArray } from '../util';

// S
import { SpotifyAPIError } from '../errors/SpotifyAPIError';

// TYPE ALIASES
type RequestInit = import('node-fetch').RequestInit;

// Global Variables
const FIVE_MINUTES = 5 * 60 * 1e3;

export class SpotifyAPI {
  static readonly REDIRECT_URI = 'http://localhost/callback';
  static readonly API_VERSION = 'v1';
  static readonly BASE_ENDPOINT = 'https://api.spotify.com';
  static readonly MAIN_API_ENDPOINT = formatEndpoint(SpotifyAPI.BASE_ENDPOINT, SpotifyAPI.API_VERSION);
  static readonly ACCOUNTS_ENDPOINT = 'https://accounts.spotify.com';
  static readonly RESOURCE_ENDPOINT = 'https://open.spotify.com';
  static readonly AUTH_ENDPOINT = formatEndpoint(SpotifyAPI.ACCOUNTS_ENDPOINT, '/authorize', {
    client_id: env.CLIENT_ID,
    response_type: 'code',
    redirect_uri: SpotifyAPI.REDIRECT_URI,
    scope: 'user-follow-read user-read-email user-read-private',
  });
  static readonly TOKEN_ENDPOINT = formatEndpoint(SpotifyAPI.ACCOUNTS_ENDPOINT, '/api/token');

  #token: SpotifyAccessToken;

  constructor(token: SpotifyAccessToken) { this.#token = token; }

  /**
   * This generates an array of artist objects. If a request in unsuccessful,
   * it throws an error containing the error details in the request.
   * @throws {SpotifyAPIError}
   */
  async *fetchFollowedArtists(): AsyncIterable<Result<ArtistObject[], SpotifyAPIError>> {
    if (!this.#token.scope.includes('user-follow-read'))
      throw new SpotifyAPIError({
        status: 401,
        message: 'Access token does not have the permission to read list of followers.',
      });

    let next = formatEndpoint(SpotifyAPI.MAIN_API_ENDPOINT, '/me/following', {
      type: 'artist',
      limit: '50',
    });

    while (next) {
      const response = await fetch(next, this.fetchOptionsForGet);
      const json = await response.json();

      if (!response.ok) {
        yield {
          ok: response.ok,
          error: new SpotifyAPIError(json as SpotifyApi.ErrorObject),
        };
        break;
      }

      const { artists } = json as SpotifyApi.UsersFollowedArtistsResponse;

      yield {
        ok: response.ok,
        value: SpotifyAPI.transformToArtistObject(artists.items),
      };

      next = artists.next;
    }
  }

  /**
   * Get all the releases from a specific artist.
   * @param id - Spotify ID of artist
   * @param market - ISO 3166-1 alpha-2 country code
   */
  async fetchReleasesByArtistID(id: string, market: string): Promise<NonPopulatedReleaseObject[]> {
    const releases: NonPopulatedReleaseObject[] = [];
    let next = formatEndpoint(SpotifyAPI.MAIN_API_ENDPOINT, `/artists/${id}/albums`, {
      market,
      include_groups: 'album,single',
      limit: '50',
    });

    // Keep retrieving until pagination stops
    while (next) {
      const json: SpotifyApi.ArtistsAlbumsResponse = await fetch(next, this.fetchOptionsForGet)
        .then(res => res.json());

      for (const release of json.items)
        // Only include releases that are available in at least one country
        if (release.available_markets && release.available_markets.length > 0)
          releases.push({
            _id: release.id,
            title: release.name,
            albumType: release.album_type,
            releaseDate: Number(Date.parse(release.release_date)),
            datePrecision: release.release_date_precision,
            availableCountries: release.available_markets,
            images: release.images,
            artists: release.artists.map(artist => artist.id),
          });

      next = json.next;
    }

    return releases;
  }

  /**
   * Fetch the API for several artists. This concurrently retrieves
   * the data in batches of `50` (Spotify's maximum limit) in order to
   * minimize the number of actual requests to the API.
   * @param ids - List of Spotify artist IDs
   */
  async fetchSeveralArtists(ids: string[]): Promise<ArtistObject[]> {
    // Divide the array into sub-arrays with maximum length of 50
    const batches = await Promise.allSettled(
      subdivideArray(ids, 50)
        .map(batch => {
          const endpoint = formatEndpoint(SpotifyAPI.MAIN_API_ENDPOINT, '/artists', {
            ids: batch.join(','),
          });
          return fetch(endpoint, this.fetchOptionsForGet)
            .then(res => res.json() as Promise<SpotifyApi.MultipleArtistsResponse>);
        }),
    );

    let artists: ArtistObject[] = [];
    for (const batch of batches)
      if (batch.status === 'fulfilled') {
        const transformedArtists = SpotifyAPI.transformToArtistObject(batch.value.artists);
        artists = artists.concat(transformedArtists);
      } else
        // TODO: Properly handle failed requests (i.e. in case of rate-limited)
        // by caching successful requests and throwing failures
        throw new SpotifyAPIError(batch.reason as SpotifyApi.ErrorObject);

    return artists;
  }

  async fetchUserProfile(): Promise<Result<UserObject, SpotifyAPIError>> {
    const scopePermissions = this.#token.scope.split(' ');
    if (!scopePermissions.includes('user-read-private') || !scopePermissions.includes('user-read-email'))
      throw new SpotifyAPIError({
        status: 401,
        message: 'Access token does not have the permission to read the user\'s profile.',
      });

    const endpoint = formatEndpoint(SpotifyAPI.MAIN_API_ENDPOINT, '/me');
    const response = await fetch(endpoint, this.fetchOptionsForGet);
    const json = await response.json();

    if (!response.ok)
      return {
        ok: response.ok,
        error: new SpotifyAPIError(json),
      };

    const user = json as SpotifyApi.UserObjectPrivate;
    return {
      ok: response.ok,
      value: {
        _id: user.id,
        name: user.display_name ?? 'User',
        country: user.country,
        // TODO: Add a default profile picture
        images: user.images ?? [],
      },
    };
  }

  // TODO: Notify route-scope if the token has been refreshed
  /** Refresh the token associated with this instance. */
  async refreshAccessToken(): Promise<SpotifyAccessToken> {
    // Retrieve new access token
    const credentials = Buffer.from(`${env.CLIENT_ID}:${env.CLIENT_SECRET}`).toString('base64');
    const newToken: Omit<OAuthToken, 'refresh_token'> = await fetch(SpotifyAPI.TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Basic ${credentials}` },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.#token.refreshToken,
      }),
    })
      .then(res => res.json());

    // Update token
    this.#token.accessToken = newToken.access_token;
    this.#token.scope = newToken.scope;
    this.#token.expiresAt = Date.now() + newToken.expires_in * 1e3;

    // Use spread operator in order to clone the object
    return { ...this.#token };
  }

  /**
   * Utility function for exchanging an authorization code for
   * an access token.
   * @param code - Valid authorization code sent to the callback URI
   */
  static async exchangeCodeForAccessToken(code: string): Promise<Result<OAuthToken, SpotifyAPIError>> {
    const response = await fetch(SpotifyAPI.TOKEN_ENDPOINT, {
      method: 'POST',
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: SpotifyAPI.REDIRECT_URI,
        client_id: env.CLIENT_ID,
        client_secret: env.CLIENT_SECRET,
      }),
    });
    const json = await response.json();

    if (!response.ok)
      return {
        ok: response.ok,
        error: new SpotifyAPIError(json as SpotifyApi.ErrorObject),
      };

    return {
      ok: response.ok,
      value: json as OAuthToken,
    };
  }

  // TODO: Move this into a Mongoose virtual
  static getURLfromArtist(artist: ArtistObject): string {
    return formatEndpoint(SpotifyAPI.RESOURCE_ENDPOINT, `/artist/${artist._id}`);
  }

  // TODO: Move this into a Mongoose virtual
  static getURLfromRelease(release: PopulatedReleaseObject|NonPopulatedReleaseObject): string {
    return formatEndpoint(SpotifyAPI.RESOURCE_ENDPOINT, `/album/${release._id}`);
  }

  // TODO: Move this into a Mongoose virtual
  static getURLfromUser(user: UserObject): string {
    return formatEndpoint(SpotifyAPI.RESOURCE_ENDPOINT, `/user/${user._id}`);
  }

  private static transformToArtistObject = (artists: SpotifyApi.ArtistObjectFull[]): ArtistObject[] => artists.map(artist => ({
    _id: artist.id,
    name: artist.name,
    followers: artist.followers.total,
    popularity: artist.popularity,
    images: artist.images,
  }));

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

  get tokenInfo(): SpotifyAccessToken { return { ...this.#token }; }
}
