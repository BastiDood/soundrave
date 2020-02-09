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

// MODULE IMPORTS
import { signJWT } from '../util/signJWT.js';
import { verifyJWT } from '../util/verifyJWT.js';

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
  .get('/', async (req, res) => {
    const { jwt } = req.signedCookies;
    const sessionAlreadyExists = Boolean(jwt);
    if (sessionAlreadyExists) {
      /** @type {AccessToken} */
      const decoded = await verifyJWT(jwt);
      let artists = [];
      let next = 'https://api.spotify.com/v1/me/following?type=artist&limit=50';
      while (next) {
        const response = await fetch(next, {
          method: 'GET',
          headers: { Authorization: `${decoded.token_type} ${decoded.access_token}` }
        });
        const json = await response.json();
        const { items } = json.artists;
        artists = [ ...artists, ...items.map(x => ({ name: x.name, url: x.external_urls.spotify })) ];
        next = json.next;
      }
      res.render('index', { artists });
    } else
      res.render('index');
  })
  .get('/login', (req, res) => {
    // TODO: Check if user session is valid. Otherwise, clear cookies and go through login flow again.
    const { jwt } = req.signedCookies;
    const sessionAlreadyExists = Boolean(jwt);
    if (sessionAlreadyExists)
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
      /** @type {AccessToken} */
      const json = await response.json();

      // Sign the data into JSON Web Token
      const encoded = await signJWT(json, json.expires_in);

      // Send off the signed cookie for cipher
      res.cookie('jwt', encoded, {
        expires: new Date(Date.now() + json.expires_in * 1e3),
        httpOnly: true,
        sameSite: 'strict',
        // secure: true,
        signed: true
      });
    }

    res.redirect('/');
  });

export { router };
