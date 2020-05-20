// NODE CORE IMPORT
import { strict as assert } from 'assert';
import { createServer } from 'http';
import path from 'path';

// DEPENDENCIES
import compression from 'compression';
import connectMongo from 'connect-mongo';
import cors from 'cors';
import express from 'express';
import exphbs from 'express-handlebars';
import Handlebars from 'handlebars';
import helmet from 'helmet';
import mongoose from 'mongoose';
import noCache from 'nocache';
import session from 'express-session';

// LOADERS
import { env } from './loaders/env';

// ROUTES
import { coreHandler, errorHandler } from './routes';

// HELPERS
import * as helpers from './views/helpers';

// GLOBAL VARIABLES
const PORT = process.env.PORT ?? 3000;
const PUBLIC_DIRECTORY = path.join(__dirname, '../public');

// Initialize `MongoStore`
const MongoStore = connectMongo(session);

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

// Activate `express-session`
app.use(session({
  name: 'sid',
  secret: env.COOKIE_SECRET,
  resave: false,
  saveUninitialized: false,
  unset: 'destroy',
  store: new MongoStore({
    url: env.MONGO_DB_SESSION_URL,
    secret: env.MONGO_DB_SESSION_SECRET,
    autoRemove: 'native',
  }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
  },
}));

// Set public files directory
app.use(express.static(PUBLIC_DIRECTORY, {
  cacheControl: false,
  dotfiles: 'ignore',
  index: false,
}));

// Delegate endpoint logic to `Router` controllers
app
  .use('/', coreHandler)
  .use('/', errorHandler);

// Initialize server
const server = createServer(app);

// Initialize Mongoose connection
mongoose.connect(env.MONGO_DB_CACHE_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
  useCreateIndex: true,
})
  .then(() => {
    // Log successful connection
    console.log('Established database connection to cache.');
    console.log(`Serving public directory from: ${PUBLIC_DIRECTORY}`);

    // Listen to the assigned port for HTTP connections
    server.listen(Number(PORT), '0.0.0.0', () => {
      const addressInfo = server.address()!;
      assert(typeof addressInfo !== 'string');
      const { address, port } = addressInfo;
      console.log(`Server started at ${address}:${port}`);
    });
  })
  .catch(console.error);
