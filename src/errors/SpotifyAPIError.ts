import { strict as assert } from 'assert';

export class SpotifyAPIError extends Error {
  /** HTTP status code received in the failed fetch */
  readonly status: number;
  readonly message: string;
  /** Amount of time (in milliseconds) to **wait** before being able to request to Spotify API again */
  readonly retryAfter: number;

  constructor({ status, message }: SpotifyApi.ErrorObject, retryAfter: number) {
    assert(retryAfter >= 0);
    super(message);
    this.status = status;
    this.message = message;
    this.retryAfter = retryAfter;
  }
}
