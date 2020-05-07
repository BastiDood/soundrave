interface SuccessfulResult<T> {
  ok: true;
  value: T;
}

interface FailedResult<T> {
  ok: false;
  error: T;
}

type Result<SuccessType, FailureType> = SuccessfulResult<SuccessType>|FailedResult<FailureType>;
