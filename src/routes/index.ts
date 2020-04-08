// NATIVE IMPORTS
import { promisify } from 'util';

// DEPENDENCIES
import express from 'express';
import geoip from 'geoip-country';

// LOADERS
import { env } from '../loaders/env';

// CONTROLLERS
import { DataFetcher } from '../controllers/DataFetcher';
import { SpotifyAPI } from '../fetchers/Spotify';

// GLOBAL VARIABLES
const router = express.Router();
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

    // Initialize Spotify fetcher
    const spotifyFetcher = new SpotifyAPI(req.session!.token!.spotify!);

    // Initialize data fetcher
    const dataFetcher = new DataFetcher(session.token!.spotify!);

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
        retrievalDate: TODAY,
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
      res.redirect(SpotifyAPI.AUTH_ENDPOINT);
  })
  .get('/callback', async (req, res) => {
    // TODO: Check if request is from Spotify accounts using `state` parameter
    // Check if authorization code exists
    const authorization = req.query as AuthorizationResult;
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
