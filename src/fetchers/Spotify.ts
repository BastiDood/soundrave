// NODE CORE IMPORTS
import { strict as assert } from 'assert';
import { URLSearchParams } from 'url';

// DEPENDENCIES
import fetch from 'node-fetch';

// LOADERS
import { env } from '../loaders/env';

// UTILITY FUNCTIONS
import { formatEndpoint, subdivideArray } from '../util';

// ERRORS
import { SpotifyAPIError } from '../errors/SpotifyAPIError';

// GLOBAL VARIABLES
const FIVE_MINUTES = 5 * 60 * 1e3;

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
export class SpotifyAPI {
  static readonly REDIRECT_URI = 'http://localhost:3000/callback';
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

  /** Reference to the user's access token (from the session) */
  #token: SpotifyAccessToken;

  /**
   * **NOTE:** This takes in a token by reference. This should be able
   * to mutate the session.
   */
  private constructor(token: SpotifyAccessToken) { this.#token = token; }

  /**
   * Initialize API by exchanging an authorization code for
   * an access token.
   * @param code - Valid authorization code sent to the callback URI
   */
  static async init(code: string): Promise<Result<SpotifyAPI, SpotifyAPIError>> {
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
    const json = response.json();

    if (!response.ok)
      return {
        ok: response.ok,
        error: new SpotifyAPIError(
          await json as SpotifyApi.ErrorObject,
          Number(response.headers.get('Retry-After')) * 1e3,
        ),
      };

    const token = await json as OAuthToken;
    return {
      ok: response.ok,
      value: new SpotifyAPI({
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: Date.now() + token.expires_in * 1e3,
        scope: token.scope.split(' '),
      }),
    };
  }

  /** Restore an already instantiated instance of the fetcher. */
  static restore(token: SpotifyAccessToken): SpotifyAPI { return new SpotifyAPI(token); }

  /** Refresh the token associated with this instance. */
  async refreshAccessToken(): Promise<Result<Readonly<SpotifyAccessToken>, SpotifyAPIError>> {
    // Retrieve new access token
    const credentials = Buffer.from(`${env.CLIENT_ID}:${env.CLIENT_SECRET}`).toString('base64');
    const response = await fetch(SpotifyAPI.TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Basic ${credentials}` },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.#token.refreshToken,
      }),
    });
    const json = response.json();

    // This should be a rare occurrence (i.e. Spotify Service is unavailable)
    if (!response.ok) {
      const { error, error_description } = await json as OAuthError;
      return {
        ok: response.ok,
        error: new SpotifyAPIError({
          status: response.status,
          message: `[${error}]: ${error_description}`,
        }, Number(response.headers.get('Retry-After')) * 1e3),
      };
    }

    // Update token
    const { access_token, scope, expires_in } = await json as Omit<OAuthToken, 'refresh_token'>;
    this.#token.accessToken = access_token;
    this.#token.scope = scope.split(' ');
    this.#token.expiresAt = Date.now() + expires_in * 1e3;

    return {
      ok: response.ok,
      value: this.#token,
    };
  }

  async fetchUserProfile(): Promise<Result<Pick<UserObject, '_id'|'profile'>, SpotifyAPIError>> {
    const { scope } = this.#token;
    if (!scope.includes('user-read-private') || !scope.includes('user-read-email'))
      return {
        ok: false,
        error: new SpotifyAPIError({
          status: 401,
          message: 'Access token does not have the permission to read the user\'s profile.',
        }, 0),
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
          country,
          retrievalDate: Date.now(),
          // TODO: Add a default profile picture
          images: images ?? [],
        },
      },
    };
  }

  /** @param etag - Associated ETag of the request */
  async *fetchFollowedArtists(etag?: string): AsyncGenerator<ETagBasedResource<ArtistObject[]|null>, SpotifyAPIError|undefined> {
    if (!this.#token.scope.includes('user-follow-read'))
      return new SpotifyAPIError({
        status: 401,
        message: 'Access token does not have the permission to read the list of followers.',
      }, 0);

    const fetchOpts = this.fetchOptionsForGet;
    if (etag)
      fetchOpts.headers['If-None-Match'] = etag;

    let next = formatEndpoint(SpotifyAPI.MAIN_API_ENDPOINT, '/me/following', {
      type: 'artist',
      limit: '50',
    });

    let error: SpotifyAPIError|undefined;
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
   * @param id - Spotify ID of artist
   * @param market - ISO 3166-1 alpha-2 country code
   */
  async *fetchReleasesByArtistID(id: string): AsyncGenerator<NonPopulatedReleaseObject[], SpotifyAPIError|undefined> {
    let next = formatEndpoint(SpotifyAPI.MAIN_API_ENDPOINT, `/artists/${id}/albums`, {
      include_groups: 'album,single',
      limit: '50',
    });

    let error: SpotifyAPIError|undefined;
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
  async fetchSeveralArtists(ids: string[]): Promise<Result<ArtistObject[], SpotifyAPIError>[]> {
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

  static getURLfromArtist(artist: ArtistObject): string {
    return formatEndpoint(SpotifyAPI.RESOURCE_ENDPOINT, `/artist/${artist._id}`);
  }

  static getURLfromRelease(release: PopulatedReleaseObject|NonPopulatedReleaseObject): string {
    return formatEndpoint(SpotifyAPI.RESOURCE_ENDPOINT, `/album/${release._id}`);
  }

  static getURLfromUser(user: UserObject): string {
    return formatEndpoint(SpotifyAPI.RESOURCE_ENDPOINT, `/user/${user._id}`);
  }

  protected static transformToArtistObject = (artist: SpotifyApi.ArtistObjectFull): ArtistObject => ({
    _id: artist.id,
    name: artist.name,
    images: artist.images,
    // **NOTE:** This refers to the date since this artist's releases have been fetched.
    retrievalDate: -Infinity,
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
  get isExpired(): boolean { return Date.now() > this.#token.expiresAt - FIVE_MINUTES; }

  get fetchOptionsForGet(): { method: 'GET'; headers: Record<string, string> } {
    // TODO: `Accept-Encoding: gz, deflate, br`
    return {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.#token.accessToken}` },
    };
  }

  get tokenInfo(): Readonly<SpotifyAccessToken> { return this.#token; }
}
