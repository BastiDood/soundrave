// TODO: Update to v0.2.0
// NATIVE IMPORT
import path from 'path';

// DEPENDENCIES
import connectMongo from 'connect-mongo';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import noCache from 'nocache';
import session from 'express-session';

// LOADERS
import { env } from './loaders/env';

// ROUTES
import { router } from './routes/index';

// Initialize `MongoStore`
const MongoStore = connectMongo(session);

// Initialize Express server
const app = express();

// Set render engine
app
  .set('view engine', 'ejs')
  .set('views', path.join(__dirname, 'src/views'));

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
const ONE_HOUR = 60;
app.use(session({
  name: 'sid',
  secret: env.COOKIE_SECRET,
  resave: false,
  saveUninitialized: false,
  unset: 'destroy',
  store: new MongoStore({
    url: env.MONGO_DB_SESSION_URL,
    secret: env.MONGO_DB_SESSION_SECRET,
    // TODO: Address the expiration of tokens, sessions, and cookies
    autoRemove: 'interval',
    autoRemoveInterval: ONE_HOUR,
  }),
  cookie: {
    httpOnly: true,
    sameSite: true,
  },
}));

// Set public files directory
app.use(express.static(path.join(__dirname, 'public'), {
  cacheControl: false,
  dotfiles: 'ignore',
  index: false,
}));

// Delegate endpoint logic to `Router` controllers
app.use('/', router);

// Initialize Mongoose connection
mongoose.connect(env.MONGO_DB_CACHE_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
})
  .then(() => {
    // Log successful connection
    console.log('Established database connection to cache.');

    // Listen to the assigned port for HTTP connections
    app.listen(Number(env.PORT), () => console.log(`Server started at port ${env.PORT}`));
  })
  .catch(console.error);
