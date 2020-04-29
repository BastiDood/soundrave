import { Schema } from 'mongoose';
import { ImageSchema } from './ImageSchema';

export const UserSchema = new Schema({
  _id: { type: String, required: true },
  name: { type: String, required: true },
  country: { type: String, required: true },
  retrievalDate: { type: Number, required: true },
  images: [ { type: ImageSchema, required: true } ],
});
