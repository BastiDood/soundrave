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

// GLOBALS
import { cacheDB, sessionDB } from './globals/db';
import { env } from './globals/env';

// ROUTES
import { coreHandler, errorHandler } from './routes';

// MIDDLEWARES
import { populateSessionData } from './middlewares/session';

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
  defaultLayout: 'main',
  helpers,
});
app
  .engine('hbs', engine)
  .set('view engine', 'hbs')
  .set('views', path.join(__dirname, 'views'));

// Compress responses
app.use(compression({ level: 9 }));

// Parse signed cookies
app.use(cookieParser(env.COOKIE_SECRET));

// Activate security headers
app
  .disable('x-powered-by')
  .use(helmet())
  .use(helmet.permittedCrossDomainPolicies())
  .use(helmet.contentSecurityPolicy({
    directives: {
      formAction: [ '\'self\'' ],
      defaultSrc: [ '\'self\'' ],
      imgSrc: [ '\'self\'', 'https://i.scdn.co' ],
      styleSrc: [ '\'self\'', 'https://fonts.googleapis.com/css2' ],
      fontSrc: [ 'https://fonts.googleapis.com/css2', 'https://fonts.gstatic.com' ],
      frameAncestors: [ '\'none\'' ],
    },
  }))
  .use(helmet.referrerPolicy({ policy: 'no-referrer' }))
  .use(noCache())
  .use(helmet.xssFilter())
  .use(helmet.noSniff())
  .use(helmet.ieNoOpen())
  .use(cors({ methods: 'GET' }));

// Set public files directory
app.use(express.static(PUBLIC_DIRECTORY, {
  cacheControl: false,
  dotfiles: 'ignore',
  index: false,
}));

// Delegate endpoint logic to `Router` controllers
app
  .use(populateSessionData)
  .use('/', coreHandler)
  .use('/', errorHandler);

// Initialize server
const server = createServer(app);
function startServer(port: number, hostname: string): Promise<void> {
  return new Promise(
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

init().catch(console.error);
