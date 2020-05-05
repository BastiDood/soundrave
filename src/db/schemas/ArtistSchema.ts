import { Schema } from 'mongoose';
import { ImageSchema } from './ImageSchema';

export const ArtistSchema = new Schema({
  _id: { type: String, required: true },
  name: { type: String, required: true },
  lastRetrieved: { type: Number, required: true },
  images: [ { type: ImageSchema, required: true } ],
});
