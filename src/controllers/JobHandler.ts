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
    // Stop processing if there are no more jobs
    const { length } = this.#jobQueue;
    if (length < 1) {
      this.#isBusy = false;
      return;
    }

    // Set the handler to "busy mode"
    const jobs = this.#jobQueue.splice(0, length);
    this.#isBusy = true;

    // Concurrently execute the entire batch
    const promises = jobs.map(job => job.execute());
    const resolvedJobs = await Promise.all(promises);
    const pendingJobs = resolvedJobs.filter(Boolean) as SpotifyJob[];

    // Queue up those with more pending jobs
    this.#jobQueue.splice(this.#jobQueue.length, 0, ...pendingJobs);

    // Continue processing other jobs
    this.emit('__process__');
  }
}
