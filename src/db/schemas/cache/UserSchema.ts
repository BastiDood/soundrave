import { Schema } from 'mongoose';
import { ProfileInfoSchema } from './ProfileInfoSchema';
import { FollowedArtistsSchema } from './FollowedArtistsSchema';
import { JobStatusSchema } from './JobStatusSchema';

export const UserSchema = new Schema({
  _id: { type: String, unique: true, required: true },
  profile: { type: ProfileInfoSchema, required: true },
  followedArtists: { type: FollowedArtistsSchema, required: true },
  job: { type: JobStatusSchema, required: true },
});
