// NODE CORE IMPORTS
import { Buffer } from 'buffer';
import { EventEmitter } from 'events';
import { strict as assert } from 'assert';
import { URLSearchParams } from 'url';

// DEPENDENCIES
import fetch from 'node-fetch';

// GLOBALS
import { env } from '../globals/env';

// UTILITY FUNCTIONS
import { formatEndpoint, subdivideArray } from '../util';

// ERRORS
import { OAuthError, SpotifyAPIError, API_ERROR_TYPES } from '../errors';

// GLOBAL VARIABLES
const FIFTEEN_MINUTES = 15 * 60 * 1e3;

// TYPES
interface ETagBasedResource<ResourceType> {
  resource: ResourceType;
  etag: string;
}

/**
 * In an attempt to maximize concurrency and minimize rate-limiting,
 * the Spotify API controller has been implemented in such a manner that
 * lazily fetches resources. It is the consumer's responsibility to continually
 * request for the next step.
 */
export class SpotifyAPI extends EventEmitter {
  static readonly REDIRECT_URI = 'http://localhost:3000/callback';
  static readonly API_VERSION = 'v1';
  static readonly BASE_ENDPOINT = 'https://api.spotify.com';
  static readonly MAIN_API_ENDPOINT = formatEndpoint(SpotifyAPI.BASE_ENDPOINT, SpotifyAPI.API_VERSION);
  static readonly ACCOUNTS_ENDPOINT = 'https://accounts.spotify.com';
  static readonly RESOURCE_ENDPOINT = 'https://open.spotify.com';
  static readonly TOKEN_ENDPOINT = formatEndpoint(SpotifyAPI.ACCOUNTS_ENDPOINT, '/api/token');

  /** Reference to the user's access token (from the session) */
  #token: AccessToken;

  /**
   * **NOTE:** This takes in a token by reference. This should be able
   * to mutate the session.
   */
  private constructor(token: AccessToken) {
    super();
    this.#token = token;
  }

  static generateAuthEndpoint(state: string): string {
    return formatEndpoint(SpotifyAPI.ACCOUNTS_ENDPOINT, '/authorize', {
      state,
      client_id: env.CLIENT_ID,
      response_type: 'code',
      redirect_uri: SpotifyAPI.REDIRECT_URI,
      scope: 'user-follow-read user-read-email user-read-private',
    });
  }

  /**
   * Initialize API by exchanging an authorization code for
   * an access token.
   * @param code - Valid authorization code sent to the callback URI
   */
  static async init(code: string): Promise<Result<SpotifyAPI, OAuthError>> {
    const response = await fetch(SpotifyAPI.TOKEN_ENDPOINT, {
      compress: true,
      method: 'POST',
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: SpotifyAPI.REDIRECT_URI,
        client_id: env.CLIENT_ID,
        client_secret: env.CLIENT_SECRET,
      }),
    });
    const json = response.json();

    const { ok, status } = response;
    if (!ok)
      return { ok, error: new OAuthError(status, await json as AuthorizationError, API_ERROR_TYPES.INIT_FAILED) };

    const token = await json as OAuthToken;
    return {
      ok,
      value: new SpotifyAPI({
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: Date.now() + token.expires_in * 1e3,
        scope: token.scope.split(' '),
      }),
    };
  }

  /** Restore an already instantiated instance of the fetcher. */
  static restore(token: AccessToken): SpotifyAPI { return new SpotifyAPI(token); }

  /** Refresh the token associated with this instance. */
  async refreshAccessToken(): Promise<Result<Readonly<AccessToken>, OAuthError>> {
    // Retrieve new access token
    const credentials = Buffer.from(`${env.CLIENT_ID}:${env.CLIENT_SECRET}`).toString('base64');
    const response = await fetch(SpotifyAPI.TOKEN_ENDPOINT, {
      compress: true,
      method: 'POST',
      headers: { Authorization: `Basic ${credentials}` },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.#token.refreshToken,
      }),
    });
    const json = response.json();

    const { ok, status } = response;
    if (!ok)
      return { ok, error: new OAuthError(status, await json as AuthorizationError, API_ERROR_TYPES.REFRESH_FAILED) };

    // Update token
    const { access_token, scope, expires_in } = await json as Omit<OAuthToken, 'refresh_token'>;
    this.#token.accessToken = access_token;
    this.#token.scope = scope.split(' ');
    this.#token.expiresAt = Date.now() + expires_in * 1e3;
    this.emit('__token_update__', this.#token);

    return {
      ok,
      value: this.#token,
    };
  }

  async fetchUserProfile(): Promise<Result<Pick<UserObject, '_id'|'profile'>, OAuthError|SpotifyAPIError>> {
    const { scope } = this.#token;
    if (!scope.includes('user-read-private') || !scope.includes('user-read-email'))
      return {
        ok: false,
        error: new OAuthError(401, {
          error: 'access_denied',
          error_description: 'Access token does not have the permission to read the user\'s profile.',
        }, API_ERROR_TYPES.NO_PERMISSION),
      };

    if (this.isExpired) {
      const refreshResult = await this.refreshAccessToken();
      if (!refreshResult.ok)
        return refreshResult;
    }

    const endpoint = formatEndpoint(SpotifyAPI.MAIN_API_ENDPOINT, '/me');
    const response = await fetch(endpoint, this.fetchOptionsForGet);
    const json = response.json();

    if (!response.ok)
      return {
        ok: response.ok,
        error: new SpotifyAPIError(
          await json as SpotifyApi.ErrorObject,
          Number(response.headers.get('Retry-After')) * 1e3,
        ),
      };

    const {
      id: _id,
      display_name,
      country,
      images,
    } = await json as SpotifyApi.UserObjectPrivate;
    return {
      ok: response.ok,
      value: {
        _id,
        profile: {
          name: display_name ?? 'User',
          country: country.toUpperCase(),
          retrievalDate: Date.now(),
          // TODO: Add a default profile picture
          images: images ?? [],
        },
      },
    };
  }

  /**
   * This generator gradually accumulates the current user's followed artists. If provided an ETag,
   * the Spotify API may quickly respond with a `304 Not Modified`, which means that it is safe to
   * use the cached version from the database. In this case, the generator immediately yields `null`,
   * which should signal to the caller that it is safe to use the locally cached version.
   *
   * Otherwise, it will return a list of artist objects each iteration.
   *
   * @param etag - Associated ETag of the request
   */
  async *fetchFollowedArtists(etag?: string): AsyncGenerator<ETagBasedResource<ArtistObject[]|null>, OAuthError|SpotifyAPIError|undefined> {
    if (!this.#token.scope.includes('user-follow-read'))
      return new OAuthError(401, {
        error: 'access_denied',
        error_description: 'Access token does not have the permission to read the user\'s followed artists.',
      }, API_ERROR_TYPES.NO_PERMISSION);

    const fetchOpts = this.fetchOptionsForGet;
    if (etag)
      fetchOpts.headers['If-None-Match'] = etag;

    let next = formatEndpoint(SpotifyAPI.MAIN_API_ENDPOINT, '/me/following', {
      type: 'artist',
      limit: '50',
    });

    let error: OAuthError|SpotifyAPIError|undefined;
    while (next) {
      if (this.isExpired) {
        const refreshResult = await this.refreshAccessToken();
        if (!refreshResult.ok) {
          error = refreshResult.error;
          break;
        }
      }

      const response = await fetch(next, fetchOpts);
      const json = response.json();

      if (response.status === 304) {
        yield {
          resource: null,
          etag: etag!,
        };
        break;
      }

      if (!response.ok) {
        error = new SpotifyAPIError(
          await json as SpotifyApi.ErrorObject,
          Number(response.headers.get('Retry-After')) * 1e3,
        );
        break;
      }

      const { artists } = await json as SpotifyApi.UsersFollowedArtistsResponse;
      const responseETag = response.headers.get('ETag');
      assert(responseETag, 'Spotify API did not provide an ETag.');

      yield {
        resource: artists.items.map(SpotifyAPI.transformToArtistObject),
        etag: responseETag,
      };

      next = artists.next;
    }

    return error;
  }

  /**
   * This generator gradually accumulates all the releases of a given artist.
   * It does not take into account the available markets so that all fetches
   * are globally available.
   *
   * For example, a user from the Philippines who follows a certain can initiate
   * the fetch for that artist. When another user from another country attempts to
   * fetch the same artist, they can simply retrieve from the cache instead.
   * See the `DataController` class for this implementation.
   *
   * @param id - Spotify ID of artist
   * */
  async *fetchReleasesByArtistID(id: string): AsyncGenerator<NonPopulatedReleaseObject[], OAuthError|SpotifyAPIError|undefined> {
    let next = formatEndpoint(SpotifyAPI.MAIN_API_ENDPOINT, `/artists/${id}/albums`, {
      include_groups: 'album,single',
      limit: '50',
    });

    let error: OAuthError|SpotifyAPIError|undefined;
    const fetchOpts = this.fetchOptionsForGet;
    while (next) {
      if (this.isExpired) {
        const refreshResult = await this.refreshAccessToken();
        if (!refreshResult.ok) {
          error = refreshResult.error;
          break;
        }
      }

      const response = await fetch(next, fetchOpts);
      const json = response.json();

      if (!response.ok) {
        error = new SpotifyAPIError(
          await json as SpotifyApi.ErrorObject,
          Number(response.headers.get('Retry-After')) * 1e3,
        );
        break;
      }

      // Only include releases that are available in at least one country
      const data = await json as SpotifyApi.ArtistsAlbumsResponse;
      yield data.items.reduce((prev, curr) => {
        const markets = curr.available_markets;
        assert(markets);
        if (markets.length > 0)
          prev.push(SpotifyAPI.transformToNonPopulatedReleaseObject(curr));
        return prev;
      }, [] as NonPopulatedReleaseObject[]);

      next = data.next;
    }

    return error;
  }

  /**
   * Fetch the API for several artists. This concurrently retrieves
   * the data in batches of `50` (Spotify's maximum limit) in order to
   * minimize the number of actual requests to the API.
   * @param ids - List of Spotify artist IDs
   */
  async fetchSeveralArtists(ids: string[]): Promise<Result<ArtistObject[], OAuthError|SpotifyAPIError>[]> {
    // If no artists were given, simply resolve with an empty array.
    if (ids.length < 1)
      return [];

    if (this.isExpired) {
      const refreshResult = await this.refreshAccessToken();
      if (!refreshResult.ok)
        return [ refreshResult ];
    }

    // Batch the requests concurrently with 50 artists each
    const fetchOpts = this.fetchOptionsForGet;
    const batches = subdivideArray(ids, 50);
    const promises = batches
      .map(async batch => {
        const endpoint = formatEndpoint(SpotifyAPI.MAIN_API_ENDPOINT, '/artists', {
          ids: batch.join(','),
        });
        const response = await fetch(endpoint, fetchOpts);
        const json = response.json();

        if (!response.ok)
          throw new SpotifyAPIError(
            await json as SpotifyApi.ErrorObject,
            Number(response.headers.get('Retry-After')) * 1e3,
          );

        const { artists } = await json as SpotifyApi.MultipleArtistsResponse;
        return artists.map(SpotifyAPI.transformToArtistObject);
      });
    const results = await Promise.allSettled(promises);

    return results
      .map(result => {
        if (result.status === 'fulfilled')
          return { ok: true, value: result.value };
        return { ok: false, error: result.reason as SpotifyAPIError };
      });
  }

  private static transformToArtistObject = (artist: SpotifyApi.ArtistObjectFull): ArtistObject => ({
    _id: artist.id,
    name: artist.name,
    images: artist.images,
    // **NOTE:** This refers to the date since this artist's releases have been fetched.
    retrievalDate: -Infinity,
  });

  private static transformToNonPopulatedReleaseObject = (release: SpotifyApi.AlbumObjectSimplified): NonPopulatedReleaseObject => ({
    _id: release.id,
    title: release.name,
    albumType: release.album_type.toLowerCase() as 'album'|'single'|'compilation',
    releaseDate: Number(Date.parse(release.release_date)),
    datePrecision: release.release_date_precision.toLowerCase() as 'year'|'month'|'day',
    availableCountries: release.available_markets!.map(market => market.toUpperCase()),
    images: release.images,
    artists: release.artists.map(artist => artist.id),
  });

  /**
   * Consider tokens that are 15 minutes to expiry as "expired"
   * and thus eligible to be refreshed.
   */
  private get isExpired(): boolean { return Date.now() > this.#token.expiresAt - FIFTEEN_MINUTES; }

  private get fetchOptionsForGet(): { headers: Record<string, string> } & import('node-fetch').RequestInit {
    return {
      compress: true,
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${this.#token.accessToken}`,
      },
    };
  }

  get tokenInfo(): Readonly<AccessToken> { return this.#token; }
}
