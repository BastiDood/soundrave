export class OAuthError extends Error {
  readonly status: number|null;
  readonly error: string;

  constructor(status: number|null, { error, error_description }: AuthorizationError) {
    super(error_description);
    this.status = status;
    this.error = error;
  }
}
