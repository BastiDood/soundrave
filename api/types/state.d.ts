import type { Database } from 'mongo';

declare interface ApplicationState {
    worker: Worker;
    db: Database;
}
