export class RateLimitError extends Error {
    /** Number of seconds until the next retry. */
    #timeout: number;

    constructor(timeout: number) {
        super(`retry fetch after ${timeout} seconds`);
        this.#timeout = timeout;
    }

    get timeout() {
        return this.#timeout;
    }
}

export class TokenExchangeError extends Error {}
export class FetchError extends Error {}
