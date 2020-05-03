import { Schema } from 'mongoose';
import { FollowedArtistsSchema } from './FollowedArtistsSchema';
import { ImageSchema } from './ImageSchema';

export const UserSchema = new Schema({
  _id: { type: String, required: true },
  name: { type: String, required: true },
  country: { type: String, required: true },
  images: [ { type: ImageSchema, required: true } ],
  followedArtists: { type: FollowedArtistsSchema, required: true },
  retrievalDate: { type: Number, required: true },
});
