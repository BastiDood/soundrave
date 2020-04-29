// NATIVE IMPORTS
import assert from 'assert';
import { promisify } from 'util';

// DEPENDENCIES
import express from 'express';

// CONTROLLERS
import { DataRetriever } from '../controllers/DataRetriever';

// FETCHERS
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
    const releases = await retriever.getReleases();

    // TODO: Get releases from artists

    res.render('index', { releases });
  })
  .get('/login', (req, res) => {
    if (req.session?.isLoggedIn)
      res.sendStatus(404);
    else
      res.redirect(SpotifyAPI.AUTH_ENDPOINT);
  })
  .get('/callback', async (req: express.Request<{}, {}, {}, AuthorizationResult>, res) => {
    const { session } = req;
    const authorization = req.query;

    // TODO: Check if request is from Spotify accounts using `state` parameter
    // Check if authorization code exists
    if (!session || !('code' in authorization)) {
      res.sendStatus(404);
      return;
    }

    // Exchange the authorization code for an access token
    const tokenResult = await SpotifyAPI.exchangeCodeForAccessToken(authorization.code);

    // TODO: Handle any authorization errors
    assert(tokenResult.ok);

    // Generate new session when the user logs in
    await promisify(session.regenerate.bind(session))();

    // Initialize session data
    const { value: token } = tokenResult;
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

    // Retrieve the real country code
    const retriever = new DataRetriever(new SpotifyAPI(session.token.spotify), session.cache);
    const userResult = await retriever.getUserProfile();

    // TODO: Handle any errors during the fetch
    assert(userResult.ok);

    // Retrieve followed artists
    const followedArtists = await retriever.getFollowedArtists();

    // TODO: Handle any error from `followedArtists.error`
    assert(!followedArtists.error);

    // Explicitly save session data due to redirect
    await promisify(session.save.bind(session))();

    // TODO: Handle error if `error in authorization`

    res.redirect('/');
  });

export { router };
