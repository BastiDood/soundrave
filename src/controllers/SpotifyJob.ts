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
  readonly #controller: DataController;
  readonly #maxReleasesLimit: number;
  #iterator: AsyncGenerator<ReleasesRetrieval>;

  constructor(sessionID: string, user: UserObject, token: AccessToken, maxReleasesLimit: number) {
    super();
    this.#controller = new DataController(sessionID, user, token);
    this.#maxReleasesLimit = maxReleasesLimit;
    this.#iterator = this.#controller.getReleases(maxReleasesLimit);
  }

  async execute(): Promise<SpotifyJob|null> {
    const retrievalResult = await this.#iterator.next();
    assert(typeof retrievalResult.done !== 'undefined');

    if (retrievalResult.done)
      return null;

    const retrieval = retrievalResult.value;
    if (this.#firstRun) {
      console.log('Resolving the first run...');
      this.#firstRun = false;
      this.emit('first-run', retrieval);
      return this;
    }

    if (retrieval.errors.length > 0)
      return this.handleErrors(retrieval.errors);

    return this;
  }

  private async handleErrors(errors: SpotifyAPIError[]): Promise<SpotifyJob> {
    // TODO: Consider the situation when the permissions fail (due to deliberate user tampering
    // with the authorization redirection link)
    // TODO: Test assumption that any error must be about rate limits
    assert(errors.every(err => err.status === 429 && err.retryAfter > 0));
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
