// NATIVE IMPORTS
import { promisify } from 'util';

// DEPENDENCIES
import express from 'express';
import geoip from 'geoip-country';

// LOADERS
import { env } from '../loaders/env';

// CONTROLLERS
import { DataRetriever } from '../controllers/DataRetriever';
import { SpotifyAPI } from '../fetchers/Spotify';

// GLOBAL VARIABLES
const router = express.Router();

router
  .get('/', async (req, res) => {
    // Shorthand for session object
    const { session } = req;

    // Reject all users that have not been logged in
    if (!session?.isLoggedIn || !session?.token) {
      res.render('index');
      return;
    }

    // Initialize followed artists cache if not already
    session.followedArtists = session.followedArtists ?? {
      ids: [],
      retrievalDate: -Infinity,
    };

    // Initialize Spotify fetcher
    const retriever = new DataRetriever(new SpotifyAPI(session.token.spotify), session.followedArtists);

    // Get releases
    const artists = await retriever.followedArtists;

    // TODO: Test if this is still a necessary step
    // Update session cache
    session.followedArtists = retriever.followedArtistsCache;
    session.token.spotify = retriever.tokenCache;

    res.render('index', { artists });
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
    const authorization = req.query;
    if ('code' in authorization) {
      const token = await SpotifyAPI.exchangeCodeForAccessToken(authorization.code);

      // Generate new session when the user logs in
      await promisify(req.session!.regenerate.bind(req.session))();

      // TODO: Use refresh tokens. Do not log user out after expiry.
      // Set session data
      const ONE_HOUR = token.expires_in * 1e3;
      req.session!.token!.spotify = {
        accessToken: token.access_token,
        refreshToken: token.refresh_token!,
        scope: token.scope,
        expiresAt: Date.now() + ONE_HOUR,
        countryCode: geoip.lookup(req.ip)?.country ?? env.DEFAULT_COUNTRY,
      };
      req.session!.cookie.maxAge = ONE_HOUR;
      req.session!.isLoggedIn = true;
      await promisify(req.session!.save.bind(req.session))();
    }

    // TODO: Handle error if `error in authorization`

    res.redirect('/');
  });

export { router };
