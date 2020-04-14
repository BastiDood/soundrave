import { Schema } from 'mongoose';

export const ImageSchema = new Schema({
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  url: { type: String, required: true },
});
