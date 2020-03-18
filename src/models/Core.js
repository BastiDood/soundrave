/**
 * @typedef {Object} ArtistObject
 * @property {string} _id - Spotify ID of the artist
 * @property {string} name
 * @property {number} followers
 * @property {number} popularity - Number between `[0, 100]` that represents artist relevance/popularity
 * @property {SpotifyApi.ImageObject[]} images
 */

/**
 * @typedef {Object} ReleaseObject
 * @property {string} _id - Spotify ID of the artist
 * @property {string} title
 * @property {string} releaseDate - Depends on the precision of the release date.
 * @property {'year'|'month'|'day'} datePrecision
 * @property {SpotifyApi.ImageObject[]} images
 * @property {ArtistObject} artist
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
  images: [ ImageSchema ]
});

const ReleaseSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  title: { type: String, required: true },
  releaseDate: { type: String, required: true },
  datePrecision: { type: String, enum: [ 'year', 'month', 'day' ], required: true },
  images: [ { type: ImageSchema, required: true } ],
  artist: { type: [ mongoose.Schema.Types.ObjectId ], ref: 'Artist', required: true }
});

export const Artist = mongoose.model('Artist', ArtistSchema);
export const Release = mongoose.model('Release', ReleaseSchema);
