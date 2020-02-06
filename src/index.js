import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';

// Initializes .env
dotenv.config();

// GLOBAL VARIABLES
const { PORT } = process.env;
const app = express();

// Enable security headers by Helmet
app.use(helmet());
app.use(helmet.permittedCrossDomainPolicies());
app.use(helmet.contentSecurityPolicy({
  directives: {
    formAction: ['\'self\''],
    defaultSrc: ['\'self\''],
    frameAncestors: ['\'none\'']
  }
}));
app.use(helmet.noCache());
app.use(helmet.referrerPolicy({
  policy: 'no-referrer'
}));

// Route endpoints
app.get('/', (req, res) => {
  res.send('Hello World');
});

// Listen to the servers
app.listen(PORT, () => {
  console.log(`Server started at port ${PORT}`);
});
