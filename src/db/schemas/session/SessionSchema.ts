import { Schema } from 'mongoose';
import { AccessTokenSchema } from './AccessTokenSchema';

// Long-lived Sessions
export const BaseSessionSchema = new Schema({
  _id: { type: String, required: true },
  userID: { type: String, required: true },
  token: { type: Map, of: AccessTokenSchema, required: true },
  createdAt: { type: Date, default: Date.now, expires: '14d' },
});

// Short-lived Sessions
export const LoginSessionSchema = new Schema({
  loginNonce: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: '5m' },
});
