// NODE CORE IMPORTS
import { createHash, randomBytes } from 'crypto';
import { promisify } from 'util';
import { strict as assert } from 'assert';

// DEPENDENCIES
import { Types } from 'mongoose';

// MODELS
import { ValidSession, LoginSession } from './models';

// UTILITY FUNCTIONS
const generate8RandomBytes = promisify(randomBytes.bind(null, 8));

export class Session {
  /** Begin a session by providing the minimal amount of data required to log in. */
  static async initialize(): Promise<LoginSessionObject> {
    const _id = new Types.ObjectId();
    const loginNonce = createHash('md5')
      .update(_id.toHexString())
      .update(await generate8RandomBytes())
      .digest('hex');
    return LoginSession.create({ _id, loginNonce });
  }

  /**
   * Upgrade the session from a short-lived one to a long-lived one.
   * @param id - ID of the `LoginSession` to be upgraded
   * @param data - Data containing everything about the new session object
   */
  static async upgrade(id: Types.ObjectId, data: Omit<ValidSessionObject, '_id'>): Promise<ValidSessionObject> {
    const [ base ] = await Promise.all([
      ValidSession.create(data),
      LoginSession.findByIdAndDelete(id).lean().exec(),
    ]);
    return base;
  }

  /**
   * @param id - ID of the `ValidSession` with the token to be updated
   * @param platform - Service from which the API token belongs to
   */
  static async updateToken(id: Types.ObjectId, platform: SupportedPlatforms, token: AccessToken): Promise<void> {
    const key = `token.${platform}`;
    const result = await ValidSession
      .findByIdAndUpdate(id, { $set: { [key]: token } })
      .lean()
      .exec();
    assert(result);
  }
}
