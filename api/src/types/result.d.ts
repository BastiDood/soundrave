interface Success<T> {
    ok: true;
    data: T;
}

interface Failure<E> {
    ok: false;
    error: E;
}

export type Result<T, E> = Success<T> | Failure<E>;
