/** @typedef {string} ArtistID */

/**
 * @typedef {Object} ArtistObject
 * @property {ArtistID} _id - Spotify ID of the artist
 * @property {string} name
 * @property {number} followers
 * @property {number} popularity - Number between `[0, 100]` that represents artist relevance/popularity
 * @property {SpotifyApi.ImageObject[]} images
 */

/**
 * @typedef {Object} ReleaseObject
 * @property {string} _id - Spotify ID of the release
 * @property {string} title
 * @property {'album'|'single'|'compilation'} albumType
 * @property {number} releaseDate - Represented as milliseconds since Unix time (in milliseconds)
 * @property {'year'|'month'|'day'} datePrecision - Determines precision of date
 * @property {string[]} availableCountries
 * @property {SpotifyApi.ImageObject[]} images
 * @property {ArtistID[]} artists - Spotify IDs of artists
 */

/**
 * @typedef {Object} PopulatedReleaseObject
 * @property {string} _id - Spotify ID of the release
 * @property {string} title
 * @property {'album'|'single'|'compilation'} albumType
 * @property {number} releaseDate - Represented as milliseconds since Unix time (in milliseconds)
 * @property {'year'|'month'|'day'} datePrecision - Determines precision of date
 * @property {string[]} availableCountries
 * @property {SpotifyApi.ImageObject[]} images
 * @property {ArtistObject[]} artists
 */

import mongoose from 'mongoose';

const ImageSchema = new mongoose.Schema({
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  url: { type: String, required: true }
});

const ArtistSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  name: { type: String, required: true },
  followers: { type: Number, required: true },
  popularity: { type: Number, required: true, min: 0, max: 100 },
  images: [ { type: ImageSchema, required: true } ]
});

const ReleaseSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  title: { type: String, required: true },
  albumType: { type: String, enum: [ 'album', 'single', 'compilation' ], required: true },
  releaseDate: { type: String, required: true },
  datePrecision: { type: String, enum: [ 'year', 'month', 'day' ], required: true },
  availableCountries: { type: [ String ], required: true },
  images: [ { type: ImageSchema, required: true } ],
  artists: { type: [ { type: String, ref: 'Artist', required: true } ], required: true }
});

export const Artist = mongoose.model('Artist', ArtistSchema);
export const Release = mongoose.model('Release', ReleaseSchema);
