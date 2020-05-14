// TODO: Update to v0.3.0
// NATIVE IMPORT
import path from 'path';

// DEPENDENCIES
import compression from 'compression';
import connectMongo from 'connect-mongo';
import cors from 'cors';
import express from 'express';
import exphbs from 'express-handlebars';
import helmet from 'helmet';
import mongoose from 'mongoose';
import noCache from 'nocache';
import session from 'express-session';

// LOADERS
import { env } from './loaders/env';

// ROUTES
import { coreHandler, errorHandler } from './routes';

// GLOBAL VARIABLES
const ONE_HOUR = 60;
const PORT = process.env.PORT ?? 3000;
const PUBLIC_DIRECTORY = path.join(__dirname, '../public');

// Initialize `MongoStore`
const MongoStore = connectMongo(session);

// Initialize Express server
const app = express();

// Set render engine
app
  .engine('hbs', exphbs({ extname: '.hbs', defaultLayout: 'main' }))
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
    autoRemove: 'interval',
    autoRemoveInterval: ONE_HOUR,
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
app.use('/', coreHandler);
app.use('/', errorHandler);

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
    app.listen(Number(PORT), () => console.log(`Server started at port ${PORT}`));
  })
  .catch(console.error);
