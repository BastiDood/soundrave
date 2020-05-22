import { Schema } from 'mongoose';
import { ImageSchema } from './ImageSchema';

export const ArtistSchema = new Schema({
  _id: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  images: [ { type: ImageSchema, required: true } ],
  retrievalDate: { type: Number, required: true },
});
