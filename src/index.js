// DEPENDENCIES
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';

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

// Enable `cookie-parser`
app.use(cookieParser(COOKIE_SECRET));

// Activate ecurity headers
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
  .use(helmet.noCache())
  .use(helmet.referrerPolicy({
    policy: 'no-referrer'
  }));

// Set public files directory
app.use(express.static('public', { index: false }));

// Delegate endpoint logic to `Router` controllers
// TODO: Add middleware that puts JWT into `req.token`
app.use('/', router);

// Listen to the servers
app.listen(PORT, () => console.log(`Server started at port ${PORT}`));
