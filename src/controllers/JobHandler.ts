// NODE CORE IMPORTS
import { EventEmitter } from 'events';

// RETRIEVERS
import { DataController } from './DataController';

// ERRORS
import { SpotifyAPIError } from '../errors/SpotifyAPIError';

interface Job<Success, Failure> {
  execute(): Promise<Success>;
  handleError(): Promise<Failure>;
}

export class JobHandler extends EventEmitter {
  #jobQueue: SpotifyJob[] = [];
  #isBusy = false;

  constructor() {
    super();
    this.prependListener('__process__', this.handleProcessing.bind(this));
  }

  addJob(job: Job<PopulatedReleaseObject[], SpotifyAPIError>): void {
    this.#jobQueue.push(job);
    if (!this.#isBusy)
      this.emit('__process__');
  }

  private async handleProcessing(): Promise<void> {
    const job = this.#jobQueue.shift();

    if (!job) {
      this.#isBusy = false;
      return;
    }

    this.#isBusy = true;

    try {
      const result = await job.execute();
      this.emit('success', result);
    } catch (err) {
      this.#jobQueue.unshift(job);
      const reason = await job.handleError();
      this.emit('error', reason);
    } finally {
      this.emit('__process__');
    }
  }
}
