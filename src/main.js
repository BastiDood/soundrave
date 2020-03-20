// TODO: Update to v0.2.0
// DEPENDENCIES
import connectMongo from 'connect-mongo';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import session from 'express-session';

// ROUTES
import { router } from './routes/index.js';

// Initializes .env
dotenv.config();
const {
  PORT,
  DEFAULT_COUNTRY,
  MONGO_DB_CACHE_URL,
  MONGO_DB_SESSION_URL,
  MONGO_DB_SESSION_SECRET,
  COOKIE_SECRET
} = process.env;

// Initialize `MongoStore`
const MongoStore = connectMongo(session);

// Initialize Express server
const app = express();

// Set render engine
app
  .set('view engine', 'ejs')
  .set('views', 'src/views');

// Activate security headers
app
  .disable('x-powered-by')
  .use(helmet())
  .use(helmet.permittedCrossDomainPolicies())
  .use(helmet.contentSecurityPolicy({
    directives: {
      formAction: ['\'self\''],
      defaultSrc: ['\'self\''],
      frameAncestors: ['\'none\'']
    }
  }))
  .use(helmet.referrerPolicy({ policy: 'no-referrer' }))
  .use(helmet.noCache())
  .use(helmet.xssFilter())
  .use(helmet.noSniff())
  .use(helmet.ieNoOpen())
  .use(cors({ methods: 'GET' }));

// Activate `express-session`
const ONE_HOUR = 60;
app.use(session({
  name: 'sid',
  secret: COOKIE_SECRET,
  resave: false,
  saveUninitialized: false,
  unset: 'destroy',
  store: new MongoStore({
    url: MONGO_DB_SESSION_URL,
    secret: MONGO_DB_SESSION_SECRET,
    // TODO: Address the expiration of tokens, sessions, and cookies
    // autoRemove: 'interval',
    // autoRemoveInterval: ONE_HOUR
  }),
  cookie: {
    httpOnly: true,
    sameSite: true
  }
}));

// Set public files directory
app.use(express.static('public', { index: false }));

// Delegate endpoint logic to `Router` controllers
app.use('/', router);

// Initialize Mongoose connection
mongoose.connect(MONGO_DB_CACHE_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false
});
mongoose.connection
  .on('error', console.error)
  .once('open', () => {
    // Log successful connection
    console.log('Established database connection to cache.');

    // Listen to the assigned port for HTTP connections
    app.listen(+PORT, () => console.log(`Server started at port ${PORT}`));
  });
