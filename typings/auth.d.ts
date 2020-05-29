interface Authorization {
  /** The value of the `state` parameter supplied in the request. */
  state?: string;
}

interface AuthorizationSuccess extends Authorization {
  /** An authorization code that can be exchanged for an access token. */
  code: string;
}

interface AuthorizationError extends Authorization {
  /** The reason authorization failed, for example: `access_denied`. */
  error: string;
  error_description: string;
}

type AuthorizationResult = AuthorizationSuccess|AuthorizationError;
