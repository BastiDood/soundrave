// NODE CORE IMPORTS
import { strict as assert } from 'assert';

// DEPENDENCIES
import dotenv from 'dotenv';

dotenv.config();

const {
  NODE_ENV,
  MAX_RELEASES,
  MONGO_DB_CACHE_URL,
  MONGO_DB_SESSION_URL,
  MONGO_DB_SESSION_SECRET,
  COOKIE_SECRET,
  CLIENT_ID,
  CLIENT_SECRET,
} = process.env;

assert(NODE_ENV);
assert(MAX_RELEASES);
assert(MONGO_DB_CACHE_URL);
assert(MONGO_DB_SESSION_URL);
assert(MONGO_DB_SESSION_SECRET);
assert(COOKIE_SECRET);
assert(CLIENT_ID);
assert(CLIENT_SECRET);

const env = {
  NODE_ENV,
  MAX_RELEASES: Number(MAX_RELEASES),
  MONGO_DB_CACHE_URL,
  MONGO_DB_SESSION_URL,
  MONGO_DB_SESSION_SECRET,
  COOKIE_SECRET,
  CLIENT_ID,
  CLIENT_SECRET,
};

export { env };
