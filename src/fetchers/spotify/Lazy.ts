// NATIVE IMPORTS
import { URLSearchParams } from 'url';

// DEPENDENCIES
import fetch from 'node-fetch';

// LOADERS
import { env } from '../../loaders/env';

// FETCHERS
import { BaseSpotifyAPI } from './Base';

// UTILITY FUNCTIONS
import { formatEndpoint } from '../../util';

// ERRORS
import { SpotifyAPIError } from '../../errors/SpotifyAPIError';

export class LazySpotifyAPI extends BaseSpotifyAPI {
  #followedArtistsNext: string|null = formatEndpoint(LazySpotifyAPI.MAIN_API_ENDPOINT, '/me/following', {
    type: 'artist',
    limit: '50',
  });

  /**
   * Utility function for exchanging an authorization code for
   * an access token.
   * @param code - Valid authorization code sent to the callback URI
   */
  static async init(code: string): Promise<Result<LazySpotifyAPI, SpotifyAPIError>> {
    const response = await fetch(LazySpotifyAPI.TOKEN_ENDPOINT, {
      method: 'POST',
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: LazySpotifyAPI.REDIRECT_URI,
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

    const token = json as OAuthToken;
    return {
      ok: response.ok,
      value: new LazySpotifyAPI({
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: Date.now() + token.expires_in * 1e3,
        scope: token.scope.split(' '),
      }),
    };
  }

  async fetchFollowedArtists(): Promise<Result<ArtistObject[]|null, SpotifyAPIError>> {
    if (!this.token.scope.includes('user-follow-read'))
      return {
        ok: false,
        error: new SpotifyAPIError({
          status: 401,
          message: 'Access token does not have the permission to read list of followers.',
        }),
      };

    const next = this.#followedArtistsNext;
    if (!next)
      return {
        ok: true,
        value: null,
      };

    const response = await fetch(next, this.fetchOptionsForGet);
    const json = await response.json();

    if (!response.ok)
      return {
        ok: false,
        error: new SpotifyAPIError(json as SpotifyApi.ErrorObject),
      };

    const { artists } = json as SpotifyApi.UsersFollowedArtistsResponse;
    this.#followedArtistsNext = artists.next;
    return {
      ok: true,
      value: artists.items.map(LazySpotifyAPI.transformToArtistObject),
    };
  }
}
