// NATIVE IMPORTS
import { URLSearchParams } from 'url';

// DEPENDENCIES
import fetch from 'node-fetch';

// LOADERS
import { env } from '../../loaders/env';

// FETCHERS
import { BaseSpotifyAPI } from './Base';

// UTILITY FUNCTIONS
import { formatEndpoint, subdivideArray } from '../../util';

// ERRORS
import { SpotifyAPIError } from '../../errors/SpotifyAPIError';

export class EagerSpotifyAPI extends BaseSpotifyAPI {
  /**
   * Utility function for exchanging an authorization code for
   * an access token.
   * @param code - Valid authorization code sent to the callback URI
   */
  static async init(code: string): Promise<Result<EagerSpotifyAPI, SpotifyAPIError>> {
    const response = await fetch(BaseSpotifyAPI.TOKEN_ENDPOINT, {
      method: 'POST',
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: BaseSpotifyAPI.REDIRECT_URI,
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
      value: new EagerSpotifyAPI({
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: Date.now() + token.expires_in * 1e3,
        scope: token.scope.split(' '),
      }),
    };
  }

  async *fetchFollowedArtists(): AsyncIterable<Result<ArtistObject[], SpotifyAPIError>> {
    if (!this.token.scope.includes('user-follow-read')) {
      yield {
        ok: false,
        error: new SpotifyAPIError({
          status: 401,
          message: 'Access token does not have the permission to read list of followers.',
        }),
      };
      return;
    }

    let next = formatEndpoint(BaseSpotifyAPI.MAIN_API_ENDPOINT, '/me/following', {
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
        value: artists.items.map(BaseSpotifyAPI.transformToArtistObject),
      };

      next = artists.next;
    }
  }

  /**
   * Get all the releases from a specific artist.
   * This has not been turned into an asynchronous
   * iterable because it is highly unlikely that an artist
   * has more than `50` releases. The overhead cost of the
   * asynchronous iterable is unnecessary in this case.
   * @param id - Spotify ID of artist
   * @param market - ISO 3166-1 alpha-2 country code
   */
  async fetchReleasesByArtistID(id: string, market: string): Promise<{
    releases: NonPopulatedReleaseObject[];
    error?: SpotifyAPIError;
  }> {
    let next = formatEndpoint(BaseSpotifyAPI.MAIN_API_ENDPOINT, `/artists/${id}/albums`, {
      market,
      include_groups: 'album,single',
      limit: '50',
    });

    // Keep retrieving until pagination stops
    const releases: NonPopulatedReleaseObject[] = [];
    while (next) {
      const response = await fetch(next, this.fetchOptionsForGet);
      const json = await response.json();

      if (!response.ok)
        return {
          releases,
          error: new SpotifyAPIError(json as SpotifyApi.ErrorObject),
        };

      const { items, next: nextURL } = json as SpotifyApi.ArtistsAlbumsResponse;
      for (const release of items)
        // Only include releases that are available in at least one country
        if (release.available_markets && release.available_markets.length > 0)
          releases.push(BaseSpotifyAPI.transformToNonPopulatedReleaseObject(release));

      next = nextURL;
    }

    return { releases };
  }

  /**
   * Fetch the API for several artists. This concurrently retrieves
   * the data in batches of `50` (Spotify's maximum limit) in order to
   * minimize the number of actual requests to the API.
   * @param ids - List of Spotify artist IDs
   */
  async fetchSeveralArtists(ids: string[]): Promise<{
    artists: ArtistObject[];
    errors: SpotifyAPIError[];
  }> {
    // Batch the requests concurrently with 50 artists each
    const batches = subdivideArray(ids, 50);
    const promises = batches
      .map(async batch => {
        const endpoint = formatEndpoint(BaseSpotifyAPI.MAIN_API_ENDPOINT, '/artists', {
          ids: batch.join(','),
        });
        const response = await fetch(endpoint, this.fetchOptionsForGet);
        const json = await response.json();

        if (!response.ok)
          throw new SpotifyAPIError(json as SpotifyApi.ErrorObject);

        const { artists } = json as SpotifyApi.MultipleArtistsResponse;
        return artists.map(BaseSpotifyAPI.transformToArtistObject);
      });
    const results = await Promise.allSettled(promises);

    // Separate the successful requests from those with errors
    const errors: SpotifyAPIError[] = [];
    let artists: ArtistObject[] = [];
    for (const result of results)
      if (result.status === 'fulfilled')
        artists = artists.concat(result.value);
      else
        errors.push(result.reason as SpotifyAPIError);

    return { artists, errors };
  }
}
