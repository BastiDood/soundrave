// DEPENDENCIES
import { createConnection } from 'mongoose';

// LOADERS
import { env } from './env';

export const cacheDB = createConnection(env.MONGO_DB_CACHE_URL);
export const sessionDB = createConnection(env.MONGO_DB_SESSION_URL);
