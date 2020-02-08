// NATIVE IMPORTS
import querystring from 'querystring';

// DEPENDENCIES
import dotenv from 'dotenv';
import express from 'express';

// Initialize .env
dotenv.config();

// GLOBAL VARIABLES
const router = express.Router();
const { CLIENT_ID } = process.env;

router
  .get('/', (req, res) => {
    res.render('index', { title: 'Spotify Timeline' });
  })
  .get('/callback', (req, res) => {
    // TODO: Check if request is from Spotify accounts
    // TODO: Handle when authorization code has been given
    // const AUTHORIZATION_CODE = req.query['code'];
    res.json(req);
  })
  .get('/login', (req, res) => {
    // TODO: Check if user session already exists
    const PARAMS = {
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: 'http://localhost:3000/login',
      scope: 'user-follow-read'
    };
    res.redirect(`https://accounts.spotify.com/authorize?${querystring.stringify(PARAMS)}`);
  });

export { router };
