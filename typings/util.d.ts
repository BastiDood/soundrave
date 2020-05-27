interface SuccessfulResult<T> {
  ok: true;
  value: T;
}

interface FailedResult<T> {
  ok: false;
  error: T;
}

type Result<SuccessType, FailureType> = SuccessfulResult<SuccessType>|FailedResult<FailureType>;

type OAuthError = import('../src/errors/OAuthError').OAuthError;
type SpotifyAPIError = import('../src/errors/SpotifyAPIError').SpotifyAPIError;
interface SegregatedErrors {
  oauth: OAuthError[];
  api: SpotifyAPIError[];
}
