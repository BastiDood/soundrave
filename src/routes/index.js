// NATIVE IMPORTS
import querystring from 'querystring';

// DEPENDENCIES
import dotenv from 'dotenv';
import express from 'express';
import fetch from 'node-fetch';

// CONTROLLERS
import { DataFetcher } from '../controllers/DataFetcher.js';

// Initialize .env
dotenv.config();
const { CLIENT_ID, CLIENT_SECRET } = process.env;

// GLOBAL VARIABLES
const router = express.Router();
const REDIRECT_URI = 'http://localhost/callback';
const REQUEST_TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
const REQUEST_AUTHORIZATION_ENDPOINT = `https://accounts.spotify.com/authorize?${querystring.stringify({
  client_id: CLIENT_ID,
  response_type: 'code',
  redirect_uri: REDIRECT_URI,
  scope: 'user-follow-read'
})}`;

router
  .get('/', async (req, res) => {
    if (!req.session.isLoggedIn) {
      res.render('index');
      return;
    }

    const dataFetcher = new DataFetcher(req.session.token);
    const artists = await dataFetcher._fetchFollowedArtists(50);
    res.render('index', { artists });
  })
  .get('/login', (req, res) => {
    if (req.session.isLoggedIn)
      res.redirect('/');
    else
      res.redirect(REQUEST_AUTHORIZATION_ENDPOINT);
  })
  .get('/callback', async (req, res) => {
    // TODO: Check if request is from Spotify accounts using `state` parameter
    // Check if authorization code exists
    const AUTHORIZATION_CODE = req.query['code'];
    if (AUTHORIZATION_CODE) {
      const urlEncodedParams = new URLSearchParams(
        querystring.stringify({
          grant_type: 'authorization_code',
          code: AUTHORIZATION_CODE,
          redirect_uri: REDIRECT_URI,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET
        })
      );
      const response = await fetch(REQUEST_TOKEN_ENDPOINT, {
        method: 'POST',
        body: urlEncodedParams,
      });

      // TODO: Use refresh tokens. Do not log user out after expiry.
      // Set session data
      /** @type {import('../controllers/DataFetcher').AccessToken} */
      const token = await response.json();
      req.session.token = token;
      req.session.cookie.maxAge = token.expires_in * 1e3;
      req.session.isLoggedIn = true;
      req.session.save(console.error);
    }

    res.redirect('/');
  });

export { router };
