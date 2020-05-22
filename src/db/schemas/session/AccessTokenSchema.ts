import { Schema } from 'mongoose';

export const AccessTokenSchema = new Schema({
  accessToken: { type: String, required: true },
  refreshToken: { type: String, required: true },
  scope: [ { type: String, required: true } ],
  expiresAt: { type: Number, required: true },
});
