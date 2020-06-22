export class NavigationError extends Error {
  /** HTTP status code received in the failed fetch. */
  readonly status: number;

  constructor() {
    super('Not found.');
    this.status = 404;
  }
}
