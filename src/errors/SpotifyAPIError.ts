// NODE CORE IMPORTS
import { strict as assert } from 'assert';

// ERRORS
import { BaseError } from './BaseError';

export class SpotifyAPIError extends BaseError {
  /** Amount of time (in milliseconds) to **wait** before being able to request to Spotify API again. */
  readonly retryAfter: number;

  constructor({ status, message }: SpotifyApi.ErrorObject, retryAfter: number) {
    assert(retryAfter > 0);
    super(status, message);
    this.retryAfter = retryAfter;
  }
}
