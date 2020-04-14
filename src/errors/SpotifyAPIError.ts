export class SpotifyAPIError extends Error {
  readonly status: number;
  readonly message: string;

  constructor(error: SpotifyApi.ErrorObject) {
    const { status, message } = error;
    super(message);
    this.status = status;
    this.message = message;
  }
}
