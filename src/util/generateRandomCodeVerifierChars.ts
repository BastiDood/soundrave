// NODE CORE IMPORTS
import { strict as assert } from 'assert';

// List of available characters use for random code verifier strings
const CHAR_SET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

/**
 * This function generates a random string (of length `length`)
 * using the possible character set for OAuth 2.0 PKCE code verifiers.
 * @param length - Number of characters in the randomized string
 */
export function *generateRandomCodeVerifierChars(length: number = 128) {
  assert(length > 0);
  for (let i = 0; i < length; ++i) {
    const rand = Math.floor(Math.random() * CHAR_SET.length);
    yield CHAR_SET.charAt(rand);
  }
}
