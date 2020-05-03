// NATIVE IMPORTS
import assert from 'assert';
import { URLSearchParams } from 'url';

// DEPENDENCIES
import fetch from 'node-fetch';

// LOADERS
import { env } from '../../loaders/env';

// UTILITY FUNCTIONS
import { formatEndpoint } from '../../util';

// ERRORS
import { SpotifyAPIError } from '../../errors/SpotifyAPIError';

// GLOBAL VARIABLES
const FIVE_MINUTES = 5 * 60 * 1e3;

export abstract class BaseSpotifyAPI {
  static readonly REDIRECT_URI = 'http://localhost/callback';
  static readonly API_VERSION = 'v1';
  static readonly BASE_ENDPOINT = 'https://api.spotify.com';
  static readonly MAIN_API_ENDPOINT = formatEndpoint(BaseSpotifyAPI.BASE_ENDPOINT, BaseSpotifyAPI.API_VERSION);
  static readonly ACCOUNTS_ENDPOINT = 'https://accounts.spotify.com';
  static readonly RESOURCE_ENDPOINT = 'https://open.spotify.com';
  static readonly AUTH_ENDPOINT = formatEndpoint(BaseSpotifyAPI.ACCOUNTS_ENDPOINT, '/authorize', {
    client_id: env.CLIENT_ID,
    response_type: 'code',
    redirect_uri: BaseSpotifyAPI.REDIRECT_URI,
    scope: 'user-follow-read user-read-email user-read-private',
  });
  static readonly TOKEN_ENDPOINT = formatEndpoint(BaseSpotifyAPI.ACCOUNTS_ENDPOINT, '/api/token');

  protected token: SpotifyAccessToken;

  protected constructor(token: SpotifyAccessToken) { this.token = token; }

  /** Refresh the token associated with this instance. */
  async refreshAccessToken(): Promise<void> {
    // Retrieve new access token
    const credentials = Buffer.from(`${env.CLIENT_ID}:${env.CLIENT_SECRET}`).toString('base64');
    const response = await fetch(BaseSpotifyAPI.TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Basic ${credentials}` },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.token.refreshToken,
      }),
    });
    const json = await response.json();

    assert(response.ok, 'Unexpected error when refreshing an access token.');

    // Update token
    const { access_token, scope, expires_in } = json as Omit<OAuthToken, 'refresh_token'>;
    this.token.accessToken = access_token;
    this.token.scope = scope.split(' ');
    this.token.expiresAt = Date.now() + expires_in * 1e3;
  }

  async fetchUserProfile(): Promise<Result<Omit<UserObject, 'followedArtists'>, SpotifyAPIError>> {
    const { scope } = this.token;
    if (!scope.includes('user-read-private') || !scope.includes('user-read-email'))
      return {
        ok: false,
        error: new SpotifyAPIError({
          status: 401,
          message: 'Access token does not have the permission to read the user\'s profile.',
        }),
      };

    const endpoint = formatEndpoint(BaseSpotifyAPI.MAIN_API_ENDPOINT, '/me');
    const response = await fetch(endpoint, this.fetchOptionsForGet);
    const json = await response.json();

    if (!response.ok)
      return {
        ok: response.ok,
        error: new SpotifyAPIError(json as SpotifyApi.ErrorObject),
      };

    const {
      id: _id,
      display_name,
      country,
      images,
    } = json as SpotifyApi.UserObjectPrivate;
    return {
      ok: response.ok,
      value: {
        _id,
        name: display_name ?? 'User',
        country,
        retrievalDate: Date.now(),
        // TODO: Add a default profile picture
        images: images ?? [],
      },
    };
  }

  // TODO: Move this into a Mongoose virtual
  static getURLfromArtist(artist: ArtistObject): string {
    return formatEndpoint(BaseSpotifyAPI.RESOURCE_ENDPOINT, `/artist/${artist._id}`);
  }

  // TODO: Move this into a Mongoose virtual
  static getURLfromRelease(release: PopulatedReleaseObject|NonPopulatedReleaseObject): string {
    return formatEndpoint(BaseSpotifyAPI.RESOURCE_ENDPOINT, `/album/${release._id}`);
  }

  // TODO: Move this into a Mongoose virtual
  static getURLfromUser(user: UserObject): string {
    return formatEndpoint(BaseSpotifyAPI.RESOURCE_ENDPOINT, `/user/${user._id}`);
  }

  protected static transformToArtistObject = (artist: SpotifyApi.ArtistObjectFull): ArtistObject => ({
    _id: artist.id,
    name: artist.name,
    popularity: artist.popularity,
    retrievalDate: Date.now(),
    images: artist.images,
  });

  protected static transformToNonPopulatedReleaseObject = (release: SpotifyApi.AlbumObjectSimplified): NonPopulatedReleaseObject => ({
    _id: release.id,
    title: release.name,
    albumType: release.album_type,
    releaseDate: Number(Date.parse(release.release_date)),
    datePrecision: release.release_date_precision,
    availableCountries: release.available_markets ?? [],
    images: release.images,
    artists: release.artists.map(artist => artist.id),
  });

  /**
   * Consider tokens that are 5 minutes to expiry as "expired"
   * and thus eligible to be refreshed.
   */
  get isExpired(): boolean { return Date.now() > this.token.expiresAt - FIVE_MINUTES; }

  get fetchOptionsForGet(): import('node-fetch').RequestInit {
    return {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.token.accessToken}` },
    };
  }
}
