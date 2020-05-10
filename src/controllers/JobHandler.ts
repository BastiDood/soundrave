// NODE CORE IMPORTS
import { EventEmitter } from 'events';

// TYPES
import type { SpotifyJob } from './SpotifyJob';

/**
 * The job handler is responsible for processing jobs in a queue-like fashion.
 * A new job will trigger the handler to begin processing until it has exhausted
 * its queue. Meanwhile, the handler can continue to receive more jobs while
 * processing others.
 */
export class JobHandler extends EventEmitter {
  #jobQueue: SpotifyJob[] = [];
  #isBusy = false;

  constructor() {
    super();
    this.prependListener('__process__', this.handleProcessing.bind(this));
  }

  addJob(job: SpotifyJob): void {
    this.#jobQueue.push(job);
    if (!this.#isBusy)
      this.emit('__process__');
  }

  private async handleProcessing(): Promise<void> {
    const job = this.#jobQueue.shift();

    // Stop processing if there are no more jobs
    if (!job) {
      this.#isBusy = false;
      return;
    }

    this.#isBusy = true;
    const result = await job.execute();

    // If there exists more jobs, then they should be executed
    // once all others have been finished.
    if (result)
      this.#jobQueue.push(result);

    // Continue processing other jobs
    this.emit('__process__');
  }
}
