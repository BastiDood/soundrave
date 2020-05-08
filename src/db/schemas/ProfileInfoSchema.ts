import { Schema } from 'mongoose';
import { ImageSchema } from './ImageSchema';

export const ProfileInfoSchema = new Schema({
  name: { type: String, required: true },
  country: { type: String, required: true },
  images: [ { type: ImageSchema, required: true } ],
  retrievalDate: { type: Number, required: true },
});
