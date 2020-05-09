// NODE CORE IMPORTS
import assert from 'assert';
import { promisify } from 'util';

// TYPES
import type { ReleaseRetrieval } from '../../typings/global';
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
  #iterator: AsyncGenerator<ReleaseRetrieval, SpotifyAPIError|undefined>;

  constructor(session: Express.Session, iterator: AsyncGenerator<ReleaseRetrieval, SpotifyAPIError|undefined>) {
    this.#session = session;
    this.#iterator = iterator;
  }

  async execute(): Promise<SpotifyJob|null> {
    const releasesResult = await this.#iterator.next();
    assert(typeof releasesResult.done !== 'undefined');

    if (releasesResult.done) {
      const error = releasesResult.value;
      if (error)
        return this.handleError(error);
      return null;
    }

    // Update the database session accordingly
    const session = this.#session;
    await promisify(session.save.bind(session))();

    return this;
  }

  async handleError(error: SpotifyAPIError): Promise<SpotifyJob> {
    // TODO: Test assumption that any errors must be about rate limits
    assert(error.status === 429);
    // TODO: Log the errors
    await sleep(error.retryAfter);
    return this;
  }
}
