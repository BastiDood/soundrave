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

assert(NODE_ENV, 'The Node environment has not been defined: `production` or `development`.');
assert(MAX_RELEASES, 'The maximum number of releases per page has not been defined.');
assert(MONGO_DB_CACHE_URL, 'The database collection in which the local cache will be stored has not been defined.');
assert(MONGO_DB_SESSION_URL, 'The database collection in which the user session data will be stored has not been defined.');
assert(MONGO_DB_SESSION_SECRET, 'The secret key that will be used to encrypt the user session data has not been defined.');
assert(COOKIE_SECRET, 'The secret that will be used to encrypt the HTTP cookies has not been defined.');
assert(CLIENT_ID, 'The public Spotify Client ID has not been defined.');
assert(CLIENT_SECRET, 'The private Spotify Client Secret has not been defined.');

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
