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
 * @property {string} releaseDate - Depends on the precision of the release date.
 * @property {SpotifyApi.ImageObject[]} images
 * @property {ArtistID[]} artists - Spotify IDs of artists
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
  releaseDate: { type: String, required: true },
  images: [ { type: ImageSchema, required: true } ],
  artists: { type: [ { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true } ], required: true }
});

export const Artist = mongoose.model('Artist', ArtistSchema);
export const Release = mongoose.model('Release', ReleaseSchema);
