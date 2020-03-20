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
import fetch from 'node-fetch';
import sort from 'fast-sort';

// MODELS
import * as CoreModels from '../models/Core.js';

// UTILITY
import { removeDuplicatesFromArrays } from '../util/removeDuplicatesFromArrays.js';

export class DataFetcher {
  /**
   * @typedef {Object} Token
   * @property {string} accessToken
   * @property {string} refreshToken
   * @property {string} scope
   * @property {number} expiresAt - Expiry date (in milliseconds since Unix Epoch)
   * @property {string} countryCode - ISO 3166-1 alpha-2 Country Code
   * @param {Token} token
   */
  constructor(token) {
    this._TOKEN = token;
    this._FETCH_OPTIONS = {
      method: 'GET',
      headers: { Authorization: `Bearer ${token.accessToken}` }
    };
  }

  /** @param {CoreModels.ArtistObject[]} artists */
  _cacheArtistObjects(artists) {
    const promises = artists.map(artist =>
      CoreModels.Artist.findByIdAndUpdate(artist._id, artist, { upsert: true }).exec());
    return Promise.allSettled(promises);
  }

  /** @param {CoreModels.ReleaseObject[]} releases */
  _cacheReleaseObjects(releases) {
    const promises = releases.map(release => CoreModels.Release
      .findByIdAndUpdate(release._id, release, { upsert: true })
      .exec());
    return Promise.allSettled(promises);
  }

  /** @returns {Promise<CoreModels.ArtistObject[]>} */
  async _fetchFollowedArtists() {
    if (!this._TOKEN.scope.includes('user-follow-read'))
      throw new Error('Access token does not have the permission to read list of followers.');

    /** @type {CoreModels.ArtistObject[]} */
    let followedArtists = [];
    let next = 'https://api.spotify.com/v1/me/following?type=artist&limit=50';

    // Retrieve all followed artists
    while (next) {
      /** @type {SpotifyApi.UsersFollowedArtistsResponse} */
      const { artists } = await fetch(next, this._FETCH_OPTIONS).then(res => res.json());
      const transformedArtistData = artists.items
        .map(artist => ({
          _id: artist.id,
          name: artist.name,
          followers: artist.followers.total,
          popularity: artist.popularity,
          images: artist.images
        }));
      followedArtists = followedArtists.concat(transformedArtistData);
      next = artists.next;
    }

    this._cacheArtistObjects(followedArtists);
    return followedArtists;
  }

  /**
   * Invoke this method **sparingly**. It greatly contributes to the rate limit.
   * @param {string} id - Spotify Artist ID
   * @returns {Promise<CoreModels.ReleaseObject[]>}
   */
  async _fetchReleasesByArtistID(id) {
    /** @type {CoreModels.ReleaseObject[]} */
    let releases = [];
    let next = `https://api.spotify.com/v1/artists/${id}/albums?${querystring.stringify({
      include_groups: 'album,single',
      market: this._TOKEN.countryCode,
      limit: 50
    })}`;

    // Retrieve all releases by the artist
    while (next) {
      /** @type {SpotifyApi.ArtistsAlbumsResponse} */
      const json = await fetch(next, this._FETCH_OPTIONS).then(res => res.json());

      /** @type {CoreModels.ReleaseObject[]} */
      const transformedReleaseData = json.items
        .map(release => ({
          _id: release.id,
          title: release.name,
          albumType: release.album_type,
          releaseDate: Number(Date.parse(release.release_date)),
          datePrecision: /** @type {'year'|'month'|'day'} */ (release.release_date_precision),
          availableCountries: release.available_markets,
          images: release.images,
          artists: release.artists.map(artist => artist.id)
        }));
      releases = releases.concat(transformedReleaseData);
      next = json.next;
    }

    this._cacheReleaseObjects(releases);
    return releases;
  }

  /**
   * Retrieve releases of artists by cache or Spotify API
   * @param {string[]} ids - Spotify Artist IDs
   * @returns {Promise<CoreModels.ReleaseObject[]>}
   */
  async getReleasesByArtistIDs(ids) {
    // Determine which releases (by artist IDs) are in the cache
    /** @type {CoreModels.PopulatedReleaseObject[]} */
    // @ts-ignore
    const cachedReleases = await CoreModels.Release
      .find({
        artists: { $in: ids },
        availableCountries: this._TOKEN.countryCode
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
    /** @type {CoreModels.ReleaseObject[][]} */
    const successfulReqs = [];
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
    /** @type {{ [string: string]: CoreModels.ReleaseObject }} */
    const lookupObject = {};
    for (const release of [ ...cachedReleases, ...successfulReqs.flat() ])
      lookupObject[release._id] = release;

    // Sort all items together by date
    const sorted = sort(Object.values(lookupObject))
      .desc(release => release.releaseDate);
    return sorted;
  }
}
