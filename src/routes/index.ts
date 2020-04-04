// NATIVE IMPORTS
import { promisify } from 'util';
import querystring from 'querystring';
import { URLSearchParams } from 'url';

// DEPENDENCIES
import dotenv from 'dotenv';
import express from 'express';
import fetch from 'node-fetch';
import geoip from 'geoip-country';

// CONTROLLERS
import { DataFetcher } from '../controllers/DataFetcher';

// Initialize .env
dotenv.config();
const { DEFAULT_COUNTRY, CLIENT_ID, CLIENT_SECRET } = process.env;

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
const ONE_WEEK = 60 * 60 * 24 * 7;

router
  .get('/', async (req, res) => {
    // Shorthand for session object
    const { session } = req;
    // Reject all users that have not been logged in
    if (!session?.isLoggedIn) {
      res.render('index');
      return;
    }

    // Initialize data fetcher
    const dataFetcher = new DataFetcher(session.token!);

    // Check if there are no cached artists in the session
    const TODAY = Date.now();
    if (!(session.followedArtists && session.followedArtists.ids)
        || session.followedArtists.retrievalDate + ONE_WEEK > TODAY
    ) {
      // Fetch followed artists
      const artists = await dataFetcher._fetchFollowedArtists();
      const artistIDs = artists.map(artist => artist._id);

      // Cache artist IDs to current session to save on memory
      session.followedArtists = {
        ids: artistIDs,
        retrievalDate: TODAY
      };
    }

    // Get releases
    const releases = await dataFetcher.getReleasesByArtistIDs(session.followedArtists.ids);
    res.render('index', { releases });
  })
  .get('/login', (req, res) => {
    if (req.session?.isLoggedIn)
      res.redirect('/');
    else
      res.redirect(REQUEST_AUTHORIZATION_ENDPOINT);
  })
  .get('/callback', async (req, res) => {
    // TODO: Check if request is from Spotify accounts using `state` parameter
    // Check if authorization code exists
    const AUTHORIZATION_CODE = req.query['code'];
    if (AUTHORIZATION_CODE) {
      const token: OAuthToken = await fetch(REQUEST_TOKEN_ENDPOINT, {
        method: 'POST',
        body: new URLSearchParams(
          querystring.stringify({
            grant_type: 'authorization_code',
            code: AUTHORIZATION_CODE,
            redirect_uri: REDIRECT_URI,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET
          })
        ),
      })
        .then(res => res.json());

      // Generate new session when the user logs in
      await promisify(req.session!.regenerate.bind(req.session))();

      // TODO: Use refresh tokens. Do not log user out after expiry.
      // Set session data
      const ONE_HOUR = token.expires_in * 1e3;
      req.session!.token = {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        scope: token.scope,
        expiresAt: Date.now() + ONE_HOUR,
        countryCode: geoip.lookup(req.ip)?.country ?? DEFAULT_COUNTRY!
      };
      req.session!.cookie.maxAge = ONE_HOUR;
      req.session!.isLoggedIn = true;
      await promisify(req.session!.save.bind(req.session))();
    }

    res.redirect('/');
  });

export { router };
