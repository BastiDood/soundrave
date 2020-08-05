// NODE CORE IMPORT
import { strict as assert } from 'assert';
import { createServer } from 'http';
import path from 'path';

// DEPENDENCIES
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import exphbs from 'express-handlebars';
import Handlebars from 'handlebars';
import helmet from 'helmet';
import noCache from 'nocache';
import staticGzip from 'express-static-gzip';

// GLOBALS
import { cacheDB, sessionDB } from './globals/db';
import { env } from './globals/env';

// ROUTES
import { coreHandler } from './routes/core';

// MIDDLEWARES
import { populateSessionData, populateUserData } from './middlewares/session';
import { handleReleaseRetrievalErrors, handleFirstPullErrors, handleNonExistentRoute } from './middlewares/error';

// HELPERS
import * as helpers from './views/helpers';

// GLOBAL VARIABLES
const PORT = process.env.PORT ?? 3000;
const PUBLIC_DIRECTORY = path.join(__dirname, '../public');

// Initialize Express server
const app = express();

// Set render engine
const engine = exphbs({
  handlebars: Handlebars,
  extname: '.hbs',
  helpers,
});
app
  .engine('hbs', engine)
  .set('view engine', 'hbs')
  .set('views', path.join(__dirname, 'views'));

// Parse signed cookies
app.use(cookieParser(env.COOKIE_SECRET));

// Activate security headers
app
  .disable('x-powered-by')
  .use(helmet())
  .use(helmet.hsts({
    includeSubDomains: true,
    preload: true,
  }))
  .use(helmet.permittedCrossDomainPolicies())
  .use(helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: [ '\'none\'' ],
      imgSrc: [ '\'self\'', 'https://i.scdn.co' ],
      scriptSrc: [ '\'self\'' ],
      styleSrc: [ '\'self\'', 'https://fonts.googleapis.com/css2' ],
      fontSrc: [ 'https://fonts.googleapis.com/css2', 'https://fonts.gstatic.com' ],
    },
  }))
  .use(helmet.referrerPolicy({ policy: 'no-referrer' }))
  .use(noCache())
  .use(helmet.xssFilter())
  .use(helmet.noSniff())
  .use(helmet.ieNoOpen())
  .use(cors({ methods: 'GET' }));

// Set public files directory
app.use(staticGzip(PUBLIC_DIRECTORY, {
  enableBrotli: true,
  index: false,
  orderPreference: [ 'br', 'gzip' ],
  serveStatic: {
    cacheControl: false,
    dotfiles: 'ignore',
    index: false,
  },
}));

// Compress dynamic responses
app.use(compression({ level: 9 }));

// Delegate endpoint logic to `Router` controllers
app
  .use(populateSessionData)
  .use(populateUserData)
  .use('/', coreHandler)
  .use(handleReleaseRetrievalErrors)
  .use(handleFirstPullErrors)
  .use(handleNonExistentRoute);

// Initialize server
const server = createServer(app);
function startServer(port: number, hostname: string): Promise<void> {
  return new Promise(
    // eslint-disable-next-line no-promise-executor-return
    resolve => server.listen(port, hostname, resolve),
  );
}

// Initialize Mongoose connections
async function init(): Promise<void> {
  await Promise.all([ cacheDB, sessionDB ]);

  // Log successful connection
  console.log('Established both database connections to cache and session store.');
  console.log(`Serving public directory from: ${PUBLIC_DIRECTORY}`);

  // Listen to the assigned port for HTTP connections
  await startServer(Number(PORT), '0.0.0.0');

  // Log server information
  const addressInfo = server.address()!;
  assert(typeof addressInfo !== 'string');
  const { address, port } = addressInfo;
  console.log(`Server started at ${address}:${port}`);
}

console.log('Connecting to databases...');
init().catch(console.error);
