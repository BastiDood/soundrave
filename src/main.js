// TODO: Update to v0.2.0
// DEPENDENCIES
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import session from 'express-session';

// ROUTES
import { router } from './routes/index.js';

// Initializes .env
dotenv.config();

// GLOBAL VARIABLES
const { PORT, COOKIE_SECRET } = process.env;
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

// Listen to the servers
app.listen(+PORT, () => console.log(`Server started at port ${PORT}`));
