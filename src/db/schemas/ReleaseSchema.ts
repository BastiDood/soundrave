import { Schema } from 'mongoose';
import { ImageSchema } from './ImageSchema';

export const ReleaseSchema = new Schema({
  _id: { type: String, required: true },
  title: { type: String, required: true },
  albumType: { type: String, enum: [ 'album', 'single', 'compilation' ], required: true },
  releaseDate: { type: Number, required: true },
  datePrecision: { type: String, enum: [ 'year', 'month', 'day' ], required: true },
  availableCountries: { type: [ String ], required: true },
  images: [ { type: ImageSchema, required: true } ],
  artists: { type: [ { type: String, ref: 'Artist', required: true } ], required: true },
})
  .index({ artists: 1, availableCountries: 1, releaseDate: -1 });

