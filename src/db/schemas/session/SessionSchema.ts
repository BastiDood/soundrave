import { Schema } from 'mongoose';
import { AccessTokenSchema } from './AccessTokenSchema';

export const BaseSessionSchema = new Schema({
  _id: { type: String, required: true },
  userID: { type: String, required: true },
  token: { type: Map, of: AccessTokenSchema, required: true },
});

export const LoginSessionSchema = new Schema({
  loginNonce: { type: String, required: true },
});
