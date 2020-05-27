import { API_ERROR_TYPES } from './ErrorTypes';

export abstract class BaseError extends Error {
  /** Application-specific code for the error type. */
  readonly type: API_ERROR_TYPES;
  /** HTTP status code received in the failed fetch. */
  readonly status: number;

  constructor(status: number, description: string, hint?: API_ERROR_TYPES) {
    super(description);
    this.status = status;

    if (status >= 500)
      this.type = API_ERROR_TYPES.EXTERNAL_ERROR;
    else if (hint)
      this.type = hint;
    else if (status === 429)
      this.type = API_ERROR_TYPES.RATE_LIMIT;
    else if (status === 404)
      this.type = API_ERROR_TYPES.NOT_FOUND;
    else if (status === 403)
      this.type = API_ERROR_TYPES.FORBIDDEN;
    else if (status === 401)
      this.type = API_ERROR_TYPES.UNAUTHORIZED;
    else
      this.type = API_ERROR_TYPES.UNKNOWN;
  }
}
