import { Schema } from 'mongoose';
import { ImageSchema } from './ImageSchema';

export const ArtistSchema = new Schema({
  _id: { type: String, required: true },
  name: { type: String, required: true },
  followers: { type: Number, required: true },
  popularity: { type: Number, required: true, min: 0, max: 100 },
  images: [ { type: ImageSchema, required: true } ],
});
