// NATIVE IMPORTS
import assert from 'assert';
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

export abstract class SpotifyAPI {
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

  protected token: SpotifyAccessToken;

  protected constructor(token: SpotifyAccessToken) { this.token = token; }

  /** Refresh the token associated with this instance. */
  async refreshAccessToken(): Promise<void> {
    // Retrieve new access token
    const credentials = Buffer.from(`${env.CLIENT_ID}:${env.CLIENT_SECRET}`).toString('base64');
    const response = await fetch(SpotifyAPI.TOKEN_ENDPOINT, {
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

    const endpoint = formatEndpoint(SpotifyAPI.MAIN_API_ENDPOINT, '/me');
    const response = await fetch(endpoint, this.fetchOptionsForGet);
    const json = response.json();

    if (!response.ok)
      return {
        ok: response.ok,
        error: new SpotifyAPIError(await json as SpotifyApi.ErrorObject),
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
        name: display_name ?? 'User',
        country,
        retrievalDate: Date.now(),
        // TODO: Add a default profile picture
        images: images ?? [],
      },
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

    let next = formatEndpoint(SpotifyAPI.MAIN_API_ENDPOINT, '/me/following', {
      type: 'artist',
      limit: '50',
    });

    while (next) {
      const response = await fetch(next, this.fetchOptionsForGet);
      const json = response.json();

      if (!response.ok) {
        yield {
          ok: response.ok,
          error: new SpotifyAPIError(await json as SpotifyApi.ErrorObject),
        };
        break;
      }

      const { artists } = await json as SpotifyApi.UsersFollowedArtistsResponse;

      yield {
        ok: response.ok,
        value: artists.items.map(SpotifyAPI.transformToArtistObject),
      };

      next = artists.next;
    }
  }

  /**
   * @param id - Spotify ID of artist
   * @param market - ISO 3166-1 alpha-2 country code
   */
  async *fetchReleasesByArtistID(id: string, market: string): AsyncIterable<Result<NonPopulatedReleaseObject[]|null, SpotifyAPIError>> {
    let next = formatEndpoint(SpotifyAPI.MAIN_API_ENDPOINT, `/artists/${id}/albums`, {
      market,
      include_groups: 'album,single',
      limit: '50',
    });

    while (next) {
      const response = await fetch(next, this.fetchOptionsForGet);
      const json = response.json();

      if (!response.ok)
        yield {
          ok: response.ok,
          error: new SpotifyAPIError(await json as SpotifyApi.ErrorObject),
        };

      const releases: NonPopulatedReleaseObject[] = [];
      const { items, next: nextURL } = await json as SpotifyApi.ArtistsAlbumsResponse;
      for (const release of items)
      // Only include releases that are available in at least one country
        if (release.available_markets && release.available_markets.length > 0)
          releases.push(SpotifyAPI.transformToNonPopulatedReleaseObject(release));

      yield {
        ok: true,
        value: releases,
      };

      next = nextURL;
    }
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
        const endpoint = formatEndpoint(SpotifyAPI.MAIN_API_ENDPOINT, '/artists', {
          ids: batch.join(','),
        });
        const response = await fetch(endpoint, this.fetchOptionsForGet);
        const json = response.json();

        if (!response.ok)
          throw new SpotifyAPIError(await json as SpotifyApi.ErrorObject);

        const { artists } = await json as SpotifyApi.MultipleArtistsResponse;
        return artists.map(SpotifyAPI.transformToArtistObject);
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
