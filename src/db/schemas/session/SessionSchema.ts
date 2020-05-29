import { Schema } from 'mongoose';
import { AccessTokenSchema } from './AccessTokenSchema';

// Long-lived Sessions
export const ValidSessionSchema = new Schema({
  _id: { type: String, required: true },
  userID: { type: String, required: true },
  token: { type: Map, of: AccessTokenSchema, required: true },
  pendingTokenUpdates: [ { type: String, enum: [ 'spotify' ] as SupportedPlatforms[], required: true } ],
  createdAt: { type: Date, default: Date.now, expires: '14d' },
});

// Short-lived Sessions
export const LoginSessionSchema = new Schema({
  _id: { type: String, required: true },
  loginNonce: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: '5m' },
});
