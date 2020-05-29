// NODE CORE IMPORTS
import { strict as assert } from 'assert';

// DEPENDENCIES
import {
  sign,
  verify,
  SignOptions,
  VerifyOptions,
  VerifyErrors,
} from 'jsonwebtoken';

// GLOBALS
import { env } from '../globals/env';

export function signJWT(payload: Record<string, string>, options: SignOptions): Promise<Result<string, Error>> {
  return new Promise(resolve => sign(payload, env.COOKIE_SECRET, options, (error, token) => {
    if (error) {
      resolve({ ok: false, error });
      return;
    }

    assert(token);
    resolve({ ok: true, value: token });
  }));
}

export function verifyJWT(token: string, options: VerifyOptions): Promise<Result<Record<string, string>, VerifyErrors>> {
  return new Promise(resolve => verify(token, env.COOKIE_SECRET, options, (error, payload) => {
    if (error) {
      resolve({ ok: false, error });
      return;
    }

    assert(payload);
    resolve({ ok: true, value: payload as Record<string, string> });
  }));
}
