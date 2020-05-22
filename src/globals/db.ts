// DEPENDENCIES
import { createConnection } from 'mongoose';

// LOADERS
import { env } from './env';

// GLOBAL VARIABLES
const config: import('mongoose').ConnectionOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
  useCreateIndex: true,
};

export const cacheDB = createConnection(env.MONGO_DB_CACHE_URL, config);
export const sessionDB = createConnection(env.MONGO_DB_SESSION_URL, config);
