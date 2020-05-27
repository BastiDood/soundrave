import { API_ERROR_TYPES } from './ErrorTypes';
import { BaseError } from './BaseError';

export class OAuthError extends BaseError {
  readonly error: string;

  constructor(status: number, { error, error_description }: AuthorizationError, hint?: API_ERROR_TYPES) {
    if (hint)
      super(status, error_description, hint);
    else if (error === 'access_denied')
      super(status, error_description, API_ERROR_TYPES.ACCESS_DENIED);
    else
      super(status, error_description);
    this.error = error;
  }
}
