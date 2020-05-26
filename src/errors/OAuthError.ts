export class OAuthError extends Error {
  readonly status: number;
  readonly error: string;

  constructor(status: number, { error, error_description }: OAuthErrorStruct) {
    super(error_description);
    this.status = status;
    this.error = error;
  }
}
