// NODE CORE IMPORTS
import { strict as assert } from 'assert';

// DEPENDENCIES
import { SafeString } from 'handlebars';

// ERRORS
import { API_ERROR_TYPES } from './ErrorTypes';
import { BaseError } from './BaseError';

export class SpotifyAPIError extends BaseError {
  /** Amount of time (in milliseconds) to **wait** before being able to request to Spotify API again. */
  readonly retryAfter: number;

  constructor({ status, message }: SpotifyApi.ErrorObject, retryAfter: number) {
    super(status, message);
    this.retryAfter = retryAfter;
    if (this.type === API_ERROR_TYPES.RATE_LIMIT) {
      assert(retryAfter >= 0);
      this.description = new SafeString(`Our servers have received so many requests that we have reached the maximum rate at which Spotify allows us to operate. Due to rate limiting, we cannot serve you right now. Please wait ${this.retryAfter} seconds before trying again. Sorry for the inconvenience!`);
    }
  }
}
