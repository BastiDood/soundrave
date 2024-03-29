// NODE CORE IMPORTS
import { createHash, randomBytes } from 'crypto';
import { promisify } from 'util';
import { strict as assert } from 'assert';

// DEPENDENCIES
import { v4 as uuid } from 'uuid';

// MODELS
import { ValidSession, LoginSession } from './models';

// UTILITY FUNCTIONS
import { generateRandomCodeVerifierChars } from '../util';
const generateRandomBytes = promisify(randomBytes);

export class Session {
  /** Begin a session by providing the minimal amount of data required to log in. */
  static async initialize(): Promise<LoginSessionObject> {
    const _id = uuid();
    const loginNonce = createHash('md5')
      .update(_id)
      .update(await generateRandomBytes(28))
      .digest('hex');
    const codeVerifier = Array.from(generateRandomCodeVerifierChars()).join('');
    return LoginSession.create({ _id, loginNonce, codeVerifier });
  }

  static check(mode: string, id: string): Promise<ValidSessionObject|LoginSessionObject|null> {
    switch (mode) {
      case 'session': return ValidSession.findById(id).lean().exec();
      case 'login': return LoginSession.findById(id).lean().exec();
      default: return Promise.resolve(null);
    }
  }

  /**
   * Upgrade the session from a short-lived one to a long-lived one.
   * @param id - ID of the `LoginSession` to be upgraded
   * @param data - Data containing everything about the new session object
   */
  static async upgrade({ _id }: LoginSessionObject, data: Omit<ValidSessionObject, '_id'>): Promise<ValidSessionObject> {
    const [ base ] = await Promise.all([
      ValidSession.create({ ...data, _id: uuid() }),
      LoginSession.findByIdAndDelete(_id).lean().exec(),
    ]);
    return base;
  }

  /** Invalidate a session from the database. */
  static async destroy(session: ValidSessionObject|LoginSessionObject): Promise<void> {
    const { _id } = session;
    let result = null;
    if ('userID' in session)
      result = await ValidSession.findByIdAndDelete(_id).lean().exec();
    else
      result = await LoginSession.findByIdAndDelete(_id).lean().exec();
    assert(result);
  }

  /**
   * @param id - ID of the `ValidSession` with the token to be updated
   * @param platform - Service from which the API token belongs to
   */
  static async updateToken(id: string, platform: SupportedPlatforms, token: AccessToken): Promise<void> {
    const key = `token.${platform}`;
    const result = await ValidSession
      .findByIdAndUpdate(id, {
        $set: { [key]: token },
        $addToSet: { 'token.pendingTokenUpdates': platform },
      })
      .exec();
    assert(result);
  }

  static async acknowledgeTokenUpdate(id: string, platform: SupportedPlatforms): Promise<void> {
    const result = await ValidSession
      .findByIdAndUpdate(id, { $pull: { 'token.pendingTokenUpdates': platform } })
      .exec();
    assert(result);
  }
}
