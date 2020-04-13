// NATIVE IMPORTS
import assert from 'assert';
import { promisify } from 'util';

// DEPENDENCIES
import express from 'express';

// CONTROLLERS
import { DataRetriever } from '../controllers/DataRetriever';
import { SpotifyAPI } from '../fetchers/Spotify';

// GLOBAL VARIABLES
const router = express.Router();

// TODO: Catch and handle bubbled events

router
  .get('/', async (req, res) => {
    // Shorthand for session object
    const { session } = req;

    // Reject all users that have not been logged in
    if (!session?.isLoggedIn
      || !session?.token
      || !session?.cache?.followedArtists
      || !session?.cache?.user
    ) {
      res.render('index');
      return;
    }

    // Initialize Spotify fetcher
    const retriever = new DataRetriever(new SpotifyAPI(session.token.spotify), session.cache as Required<SessionCache>);
    const artistObjects = await retriever.getFollowedArtists();

    // TODO: Get releases from artists

    res.render('index', { artists: artistObjects.artists });
  })
  .get('/login', (req, res) => {
    if (req.session?.isLoggedIn)
      res.redirect('/');
    else
      res.redirect(SpotifyAPI.AUTH_ENDPOINT);
  })
  .get('/callback', async (req: express.Request<{}, {}, {}, AuthorizationResult>, res) => {
    // TODO: Check if request is from Spotify accounts using `state` parameter
    // Check if authorization code exists
    const { session } = req;
    const authorization = req.query;
    if (session && 'code' in authorization) {
      // Exchange the authorization code for an access token
      const token = await SpotifyAPI.exchangeCodeForAccessToken(authorization.code);

      // Generate new session when the user logs in
      await promisify(session.regenerate.bind(req.session))();

      // TODO: Notify route-scope if the token has been refreshed
      // Initialize session data
      const ONE_HOUR = token.expires_in * 1e3;
      session.token = Object.create(null);
      assert(session.token);
      session.token.spotify = {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        scope: token.scope,
        expiresAt: Date.now() + ONE_HOUR,
      };
      session.cookie.maxAge = ONE_HOUR;
      session.isLoggedIn = true;

      // Initialize session cache
      session.cache = Object.create(null);
      assert(session.cache);
      session.cache.followedArtists = {
        ids: [],
        retrievalDate: -Infinity,
      };
      assert(session.cache.followedArtists);
      session.cache.user = Object.create(null);
      assert(session.cache.user);

      // Retrieve the real country code
      const api = new SpotifyAPI(session.token.spotify);
      const user = await api.fetchUserProfile();
      session.cache.user.country = user.country;

      // Retrieve followed artists
      const retriever = new DataRetriever(new SpotifyAPI(session.token.spotify), session.cache as Required<SessionCache>);
      session.cache.followedArtists = await retriever.getFollowedArtistIDs();

      // Explicitly save session data due to redirect
      await promisify(session.save.bind(req.session))();
    }

    // TODO: Handle error if `error in authorization`

    res.redirect('/');
  });

export { router };
