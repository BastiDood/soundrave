/**
 * Source: https://developer.spotify.com/documentation/general/guides/authorization-guide/
 * @typedef {Object} AccessToken
 * @property {string} access_token - An access token that can be provided in subsequent calls,
 * for example to Spotify Web API services.
 * @property {'Bearer'} token_type - How the access token may be used: always “Bearer”.
 * @property {string} scope - A space-separated list of scopes which have been granted for this `access_token`.
 * @property {number} expires_in - The time period (in seconds) for which the access token is valid.
 * @property {string} refresh_token - A token that can be sent to the Spotify Accounts service in place
 * of an authorization code. (When the access code expires, send a POST request to the Accounts service
 * `/api/token` endpoint, but use this code in place of an authorization code. A new access token will be returned.
 * A new refresh token might be returned too.)
 */

// TODO: Handle rate-limited fetches
// NATIVE IMPORTS
import querystring from 'querystring';

// DEPENDENCIES
import fetch, { RequestInit } from 'node-fetch';

// MODELS
import { Artist, Release } from '../models/Core';

// UTILITY
import { removeDuplicatesFromArrays } from '../util/removeDuplicatesFromArrays';
import { revInsertionSortInDesc } from '../util/revInsertionSortInDesc';

export class DataFetcher {
  #TOKEN: SpotifyAccessToken;
  #FETCH_OPTIONS: RequestInit;

  constructor(token: SpotifyAccessToken) {
    this.#TOKEN = token;
    this.#FETCH_OPTIONS = {
      method: 'GET',
      headers: { Authorization: `Bearer ${token.accessToken}` },
    };
  }

  static _cacheArtistObjects(artists: ArtistObject[]) {
    const promises = artists.map(artist =>
      Artist.findByIdAndUpdate(artist._id, artist, { upsert: true }).exec());
    return Promise.allSettled(promises);
  }

  static _cacheReleaseObjects(releases: ReleaseObject[]) {
    const promises = releases.map(release => Release
      .findByIdAndUpdate(release._id, release, { upsert: true })
      .exec());
    return Promise.allSettled(promises);
  }

  async _fetchFollowedArtists(): Promise<ArtistObject[]> {
    if (!this.#TOKEN.scope.includes('user-follow-read'))
      throw new Error('Access token does not have the permission to read list of followers.');

    let followedArtists: ArtistObject[] = [];
    let next = 'https://api.spotify.com/v1/me/following?type=artist&limit=50';

    // Retrieve all followed artists
    while (next) {
      const { artists }: SpotifyApi.UsersFollowedArtistsResponse = await fetch(next, this.#FETCH_OPTIONS).then(res => res.json());
      const transformedArtistData = artists.items
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

    DataFetcher._cacheArtistObjects(followedArtists);
    return followedArtists;
  }

  /**
   * Invoke this method **sparingly**. It greatly contributes to the rate limit.
   * @param id - Spotify Artist ID
   */
  async _fetchReleasesByArtistID(id: string): Promise<ReleaseObject[]> {
    let releases: ReleaseObject[] = [];
    let next = `https://api.spotify.com/v1/artists/${id}/albums?${querystring.stringify({
      include_groups: 'album,single',
      market: this.#TOKEN.countryCode,
      limit: 50,
    })}`;

    // Retrieve all releases by the artist
    while (next) {
      const json: SpotifyApi.ArtistsAlbumsResponse = await fetch(next, this.#FETCH_OPTIONS).then(res => res.json());

      const transformedReleaseData: ReleaseObject[] = json.items
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

    DataFetcher._cacheReleaseObjects(releases);
    return releases;
  }

  /**
   * Retrieve releases of artists by cache or Spotify API
   * @param ids - Spotify Artist IDs
   */
  async getReleasesByArtistIDs(ids: string[]): Promise<PopulatedReleaseObject[]> {
    // Determine which releases (by artist IDs) are in the cache
    // @ts-ignore
    const cachedReleases: PopulatedReleaseObject[] = await Release
      .find({
        artists: { $in: ids },
        availableCountries: this.#TOKEN.countryCode,
      })
      .sort({ releaseDate: -1 })
      .populate('artists')
      .exec();
    const artistIDsOfCachedReleases = cachedReleases
      .map(release => release.artists.map(artist => artist._id));
    const remainingArtistIDs = removeDuplicatesFromArrays(ids, ...artistIDsOfCachedReleases);

    // Fetch Spotify API for those that have not been cached yet
    const promises = remainingArtistIDs.map(id => this._fetchReleasesByArtistID(id));
    const settledPromises = await Promise.allSettled(promises);

    // Separate successful requests from failed requests
    const successfulReqs: ReleaseObject[][] = [];
    const failedReqs = [];
    for (const promise of settledPromises)
      if (promise.status === 'fulfilled')
        successfulReqs.push(promise.value);
      else if (promise.status === 'rejected')
        failedReqs.push(promise.reason);

    // TODO: Handle errors, especially in cases of errors
    console.table(failedReqs);

    // Merge successful requests with the cached releases
    // by removing duplicate releases (by ID)
    // See https://reactgo.com/removeduplicateobjects/#here-is-my-implementation-to-remove-the-duplicate-objects-from-an-array.
    const lookupObject: { [id: string]: PopulatedReleaseObject } = Object.create(null);
    for (const release of [ ...cachedReleases, ...successfulReqs.flat() ])
      // @ts-ignore
      // FIXME: Resolve issue between populated and non-populated release objects
      lookupObject[release._id] = release;

    // Sort all items together by date
    return revInsertionSortInDesc(Object.values(lookupObject), release => release.releaseDate);
  }
}
