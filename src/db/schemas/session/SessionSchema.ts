import { Schema } from 'mongoose';
import { AccessTokenSchema } from './AccessTokenSchema';

export const SessionSchema = new Schema({
  _id: { type: String, required: true },
  userID: String,
  token: { type: Map, of: AccessTokenSchema },
  loginNonce: String,
});
