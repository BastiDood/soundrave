import { strict as assert } from 'assert';
import { API_ERROR_TYPES } from './ErrorTypes';
import { BaseError } from './BaseError';

export class SpotifyAPIError extends BaseError {
  /** Amount of time (in milliseconds) to **wait** before being able to request to Spotify API again. */
  readonly retryAfter: number;

  constructor({ status, message }: SpotifyApi.ErrorObject, retryAfter: number) {
    super(status, message);
    if (this.type === API_ERROR_TYPES.RATE_LIMIT)
      assert(retryAfter >= 0);
    this.retryAfter = retryAfter;
  }
}
