/**
 * Source: https://developer.spotify.com/documentation/general/guides/authorization-guide/
 * @typedef {Object} AccessToken
 * @property {string} access_token - An access token that can be provided in subsequent calls,
 * for example to Spotify Web API services.
 * @property {'Bearer'} token_type - How the access token may be used: always “Bearer”.
 * @property {string} scope - A space-separated list of scopes which have been granted for this `access_token`.
 * @property {number} expires_in - The time period (in seconds) for which the access token is valid.
 * @property {string} refresh_token - A token that can be sent to the Spotify Accounts service in place
 * of an authorization code. (When the access code expires, send a POST request to the Accounts service
 * `/api/token` endpoint, but use this code in place of an authorization code. A new access token will be returned.
 * A new refresh token might be returned too.)
 */

// NATIVE IMPORTS
import querystring from 'querystring';

// DEPENDENCIES
import dotenv from 'dotenv';
import express from 'express';
import fetch from 'node-fetch';

// Initialize .env
dotenv.config();

// GLOBAL VARIABLES
const router = express.Router();
const { CLIENT_ID, CLIENT_SECRET } = process.env;
const REDIRECT_URI = 'http://localhost:3000/callback';
const REQUEST_TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
const REQUEST_AUTHORIZATION_ENDPOINT = `https://accounts.spotify.com/authorize?${querystring.stringify({
  client_id: CLIENT_ID,
  response_type: 'code',
  redirect_uri: REDIRECT_URI,
  scope: 'user-follow-read'
})}`;

router
  .get('/', (req, res) => {
    res.render('index', { title: 'Spotify Timeline' });
  })
  .get('/login', (req, res) => {
    // TODO: Check if user session already exists
    res.redirect(REQUEST_AUTHORIZATION_ENDPOINT);
  })
  .get('/callback', async (req, res) => {
    // TODO: Handle when authorization code has been given
    // TODO: Check if request is from Spotify accounts using `state` parameter
    const AUTHORIZATION_CODE = req.query['code'];

    // Check if authorization code exists
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
      // TODO: Obscure `key` names
      // TODO: Consider converting cookies to JSON cookies
      /** @type {AccessToken} */
      const json = await response.json();
      for (const [ key, value ] of Object.entries(json))
        res.cookie(key, value, {
          httpOnly: true,
          sameSite: 'strict',
          // secure: true,
          signed: true
        });
      // TODO: Remove this logger
      console.log(json);
    }

    res.redirect('/');
  });

export { router };
