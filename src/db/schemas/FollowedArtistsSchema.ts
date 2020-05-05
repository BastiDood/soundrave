import { Schema } from 'mongoose';

export const FollowedArtistsSchema = new Schema({
  ids: [ { type: String, ref: 'Artist', required: true } ],
  etag: { type: String, required: true },
  retrievalDate: { type: Number, required: true },
});
