// NODE CORE IMPORTS
import { strict as assert } from 'assert';
import { promisify } from 'util';

// TYPES
import type { SpotifyAPIError } from '../errors/SpotifyAPIError';

// GLOBAL VARIABLES
const sleep = promisify(setTimeout);

/**
 * In the case of rate limiting, a `SpotifyJob` shall block further execution,
 * as specified in the `Retry-After` header sent by the Spotify API. Once it
 * stops blocking execution, the `SpotifyJob` shall be sent to the back of the queue
 * to give the blocked requests a chance to execute.
 */
export class SpotifyJob {
  #session: Express.Session;
  #iterator: AsyncGenerator<ReleasesRetrieval, SpotifyAPIError[]>;

  constructor(session: Express.Session, iterator: AsyncGenerator<ReleasesRetrieval, SpotifyAPIError[]>) {
    this.#session = session;
    this.#iterator = iterator;
  }

  async execute(): Promise<SpotifyJob|null> {
    const releasesResult = await this.#iterator.next();
    assert(typeof releasesResult.done !== 'undefined');

    if (releasesResult.done) {
      const errors = releasesResult.value;
      if (errors.length > 0)
        return this.handleError(errors);
      return null;
    }

    // Update the database session accordingly
    const session = this.#session;
    await promisify(session.save.bind(session))();

    return this;
  }

  async handleError(errors: SpotifyAPIError[]): Promise<SpotifyJob> {
    // TODO: Test assumption that any error must be about rate limits
    const maxRetryAfter = Math.max(...errors.map(err => err.retryAfter));
    assert(maxRetryAfter > 0);

    const sleepPeriod = maxRetryAfter + 1e3;
    console.log(`Errors were encountered in the background. Now sleeping for ${maxRetryAfter} seconds...`);
    await sleep(sleepPeriod);
    console.log('Resuming background processing...');

    return this;
  }
}
