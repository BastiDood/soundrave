// TODO: Update to v0.2.0
// DEPENDENCIES
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
const { PORT, MONGO_DB_URL, COOKIE_SECRET } = process.env;

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

// TODO: Delegate `connect-mongo` as the persistent session store
// Activate `express-session`
app.use(session({
  name: 'sid',
  secret: COOKIE_SECRET,
  resave: false,
  saveUninitialized: false,
  unset: 'destroy',
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
mongoose.connect(MONGO_DB_URL, { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false });
mongoose.connection
  .on('error', console.error)
  .once('open', () => {
    // Log successful connection
    console.log('Established database connection.');

    // Listen to the assigned port for HTTP connections
    app.listen(+PORT, () => console.log(`Server started at port ${PORT}`));
  });
