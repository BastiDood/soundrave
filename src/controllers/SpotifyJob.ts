// NODE CORE IMPORTS
import { EventEmitter } from 'events';
import { strict as assert } from 'assert';
import { promisify } from 'util';

// CONTROLLERS
import { DataController } from '.';

// ERRORS
import { OAuthError, SpotifyAPIError, API_ERROR_TYPES } from '../errors';

// GLOBAL VARIABLES
const sleep = promisify(setTimeout);

/**
 * In the case of rate limiting, a `SpotifyJob` shall block further execution,
 * as specified in the `Retry-After` header sent by the Spotify API. Once it
 * stops blocking execution, the `SpotifyJob` shall be sent to the back of the queue
 * to give the blocked requests a chance to execute.
 *
 * The ideal lifecycle of a `SpotifyJob` is to keep executing. In the case of any errors,
 * it shall emit a `__stall__` event with the number of milliseconds until it resumes.
 * After the stall period, it emits the `__resume__` event to continue the looping.
 */
export class SpotifyJob extends EventEmitter {
  /** Indicates if the current iteration was the first execution */
  #firstRun = true;
  readonly #controller: DataController;
  #iterator: AsyncGenerator<ReleasesRetrieval>;

  constructor(sessionID: string, user: UserObject, token: AccessToken) {
    super();
    this.#controller = new DataController(sessionID, user, token);
    this.#iterator = this.#controller.getReleases();
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

  private async handleErrors(errors: (OAuthError|SpotifyAPIError)[]): Promise<SpotifyJob|null> {
    const highestSeverityError = errors.reduce((max, curr) => {
      if (curr.type > max.type)
        return curr;
      return max;
    });

    // Wait until the rate limit is done
    if (highestSeverityError instanceof SpotifyAPIError && highestSeverityError.type === API_ERROR_TYPES.RATE_LIMIT) {
      // Add one second of cooldown after Spotify's recommended retry period (just to be sure)
      const sleepPeriod = highestSeverityError.retryAfter + 1e3;
      this.emit('__stall__', sleepPeriod);
      console.log(`Now sleeping for ${highestSeverityError.retryAfter} seconds...`);
      await sleep(sleepPeriod);
      this.emit('__resume__', 0);

      console.log('Resuming background processing...');
      this.#iterator = this.#controller.getReleases();

      return this;
    }

    // Cancel the job for any OAuth errors or external API errors
    console.log('Unexpected errors were encountered in the background. The job has been cancelled.');
    console.table(errors);
    return null;
  }
}
