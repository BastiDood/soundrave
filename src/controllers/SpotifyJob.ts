// NODE CORE IMPORTS
import { EventEmitter } from 'events';
import { strict as assert } from 'assert';
import { promisify } from 'util';

// CONTROLLERS
import { DataController } from '.';

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
export class SpotifyJob extends EventEmitter {
  /** Indicates if the current iteration was the first execution */
  #firstRun = true;
  readonly #maxReleasesLimit: number;
  readonly #controller: DataController;
  #iterator: AsyncGenerator<ReleasesRetrieval, SpotifyAPIError[]>;

  constructor(sessionData: Required<BaseSession>, maxReleasesLimit: number) {
    super();
    this.#controller = new DataController(sessionData);
    this.#maxReleasesLimit = maxReleasesLimit;
    this.#iterator = this.#controller.getReleases(maxReleasesLimit);
  }

  async execute(): Promise<SpotifyJob|null> {
    console.log('Executing job in the background...');
    const releasesResult = await this.#iterator.next();
    assert(typeof releasesResult.done !== 'undefined');

    if (this.#firstRun) {
      console.log('Resolving the first run...');
      this.#firstRun = false;
      this.emit('first-run', releasesResult.value);
    }

    if (releasesResult.done) {
      const errors = releasesResult.value;
      if (errors.length > 0)
        return this.handleError(errors);
      console.log('All jobs done.');
      return null;
    }

    return this;
  }

  private async handleError(errors: SpotifyAPIError[]): Promise<SpotifyJob> {
    console.log('Errors were encountered in the background.');
    errors.forEach(err => console.error(err));

    // TODO: Test assumption that any error must be about rate limits
    // TODO: Consider the situation when the permissions fail (due to unexpected user tampering
    // with the authorization redirection link)
    const maxRetryAfter = Math.max(...errors.map(err => err.retryAfter));
    assert(maxRetryAfter > 0);

    const sleepPeriod = maxRetryAfter + 1e3;
    console.log(`Now sleeping for ${maxRetryAfter} seconds...`);
    await sleep(sleepPeriod);

    console.log('Resuming background processing...');
    this.#iterator = this.#controller.getReleases(this.#maxReleasesLimit);

    return this;
  }
}
