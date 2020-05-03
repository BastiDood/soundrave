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
  #releasesByArtistIDNext: Record<string, string> = Object.create(null);

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

  async fetchReleasesByArtistID(id: string, market: string): Promise<Result<NonPopulatedReleaseObject[]|null, SpotifyAPIError>> {
    if (!this.#releasesByArtistIDNext[id])
      this.#releasesByArtistIDNext[id] = formatEndpoint(LazySpotifyAPI.MAIN_API_ENDPOINT, `/artists/${id}/albums`, {
        market,
        include_groups: 'album,single',
        limit: '50',
      });

    const next = this.#releasesByArtistIDNext[id];
    const response = await fetch(next, this.fetchOptionsForGet);
    const json = await response.json();

    if (!response.ok)
      return {
        ok: response.ok,
        error: new SpotifyAPIError(json as SpotifyApi.ErrorObject),
      };

    const releases: NonPopulatedReleaseObject[] = [];
    const { items, next: nextURL } = json as SpotifyApi.ArtistsAlbumsResponse;
    for (const release of items)
      // Only include releases that are available in at least one country
      if (release.available_markets && release.available_markets.length > 0)
        releases.push(LazySpotifyAPI.transformToNonPopulatedReleaseObject(release));

    this.#releasesByArtistIDNext[id] = nextURL;
    return {
      ok: true,
      value: releases,
    };
  }
}
