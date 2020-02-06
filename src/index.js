import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';

// Initializes .env
dotenv.config();

// GLOBAL VARIABLES
const { PORT } = process.env;
const app = express();

// Set render engine
app.set('view engine', 'ejs');
app.set('views', 'src/views');

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

// Set public files directory
app.use(express.static('public', { index: false }));

// Route endpoints
app.get('/', (req, res) => {
  res.render('index', { msg: 'Hello World' });
});

// Listen to the servers
app.listen(PORT, () => {
  console.log(`Server started at port ${PORT}`);
});
