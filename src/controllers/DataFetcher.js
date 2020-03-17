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

/**
 * Spotify API response to list of user's followed artists.
 * @typedef {Object} FollowedArtistsReponse
 * @property {SpotifyApi.CursorBasedPagingObject<SpotifyApi.ArtistObjectFull>} artists
 */

// DEPENDENCIES
import fetch from 'node-fetch';

// MODELS
import * as CoreModels from '../models/Core.js';

export class DataFetcher {
  /** @param {CoreModels.ArtistObject[]} artists */
  static async _cacheFollowedArtists(artists) {
    const promises = artists.map(artist => {
      const doc = new CoreModels.Artist(artist);
      return doc.save();
    });
    await Promise.all(promises);
  }

  /**
   * @param {AccessToken} token - Access token for the Spotify API
   * @param {number} limit - Maximum number of artists to be fetched.
   * @returns {Promise<CoreModels.ArtistObject[]>}
   */
  static async _fetchFollowedArtists(token, limit) {
    // TODO: Cache the session user's followed artists
    const FETCH_OPTIONS = {
      method: 'GET',
      headers: { Authorization: `${token.token_type} ${token.access_token}` }
    };
    /** @type {CoreModels.ArtistObject[]} */
    let followedArtists = [];
    let next = `https://api.spotify.com/v1/me/following?type=artist&limit=${limit}`;
    while (next) {
      /** @type {FollowedArtistsReponse} */
      const { artists } = await fetch(next, FETCH_OPTIONS).then(res => res.json());
      const transformedArtistData = artists.items
        .map(artist => ({
          _id: artist.id,
          name: artist.name,
          url: artist.external_urls.spotify,
          followers: artist.followers.total,
          popularity: artist.popularity,
          images: artist.images
        }));
      followedArtists = followedArtists.concat(transformedArtistData);
      next = artists.next;
    }
    this._cacheFollowedArtists(followedArtists);
    return followedArtists;
  }
}
