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
  #iterator: AsyncGenerator<ReleasesRetrieval>;

  constructor(user: UserObject, token: SpotifyAccessToken, maxReleasesLimit: number) {
    super();
    this.#controller = new DataController(user, token);
    this.#maxReleasesLimit = maxReleasesLimit;
    this.#iterator = this.#controller.getReleases(maxReleasesLimit);
  }

  async execute(): Promise<SpotifyJob|null> {
    console.log('Executing job in the background...');
    const retrievalResult = await this.#iterator.next();
    assert(typeof retrievalResult.done !== 'undefined');

    if (retrievalResult.done) {
      console.log('All jobs done.');
      return null;
    }

    const retrieval = retrievalResult.value;
    if (this.#firstRun) {
      console.log('Resolving the first run...');
      this.#firstRun = false;
      this.emit('first-run', retrieval);
      return this;
    }

    if (retrieval.errors.length > 0)
      return this.handleErrors(retrieval.errors);

    console.log('Background job successfully executed without any errors.');
    return this;
  }

  private async handleErrors(errors: SpotifyAPIError[]): Promise<SpotifyJob> {
    // TODO: Test assumption that any error must be about rate limits
    assert(errors.every(err => err.status === 429 && err.retryAfter > 0));

    // TODO: Consider the situation when the permissions fail (due to unexpected user tampering
    // with the authorization redirection link)
    const maxRetryAfter = Math.max(...errors.map(err => err.retryAfter));

    // Add one second of cooldown after Spotify's recommended retry period (just to be sure)
    const sleepPeriod = maxRetryAfter + 1e3;
    console.log(`Now sleeping for ${maxRetryAfter} seconds...`);
    await sleep(sleepPeriod);

    console.log('Resuming background processing...');
    this.#iterator = this.#controller.getReleases(this.#maxReleasesLimit);

    return this;
  }
}
