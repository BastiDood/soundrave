// NODE CORE IMPORTS
import { strict as assert } from 'assert';

// DEPENDENCIES
import express from 'express';

// GLOBALS
import { backgroundJobHandler } from '../globals/backgroundJobHandler';
import { env } from '../globals/env';

// CONTROLLERS
import { DataController, SpotifyJob } from '../controllers';

// DATABASE
import { Cache } from '../db/Cache';
import { Session } from '../db/Session';

// FETCHERS
import { SpotifyAPI } from '../fetchers/Spotify';

// ERRORS
import { SpotifyAPIError, OAuthError, API_ERROR_TYPES } from '../errors';

// GLOBAL VARIABLES
const router = express.Router();
const ONE_MINUTE = 60 * 1e3;
const ONE_DAY = ONE_MINUTE * 60 * 24;
const defaultCookieOptions: express.CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  signed: true,
};

router
  // @ts-expect-error
  .get('/', (req, res) => res.render('index', { layout: 'home' } as Render.HomeContext))
  // @ts-expect-error
  .get('/about', (req, res) => res.render('about', { layout: 'about' } as Render.AboutContext))
  // TODO: Set a timeout for stalling requests
  .get('/timeline', async (req, res, next) => {
    // Shorthand for session object
    const { session } = req;

    // Deflect all users that have not been logged in
    if (!session || 'loginNonce' in session) {
      console.log('Received a user that is not logged in.');
      res.redirect('/login');
      return;
    }

    // Synchronize the session user object with the database user object
    const { user } = req;
    assert(user);

    // Retrieve the access token
    const spotifyToken = session.token.spotify;

    // Synchronize the cookie's `maxAge`
    if (session.pendingTokenUpdates.includes('spotify')) {
      const remainingTime = spotifyToken.expiresAt - Date.now();
      const remainingSeconds = Math.floor(remainingTime / 1e3);
      const options = { ...defaultCookieOptions, maxAge: ONE_DAY * 14 - remainingSeconds };
      res.cookie('sid', session._id, options);
      res.cookie('mode', 'session', options);
      await Session.acknowledgeTokenUpdate(session._id, 'spotify');
    }

    // Temporarily return all known releases thus far if the user currently has pending jobs
    const hasStaleData = Date.now() > user.job.dateLastDone + DataController.STALE_PERIOD.LAST_DONE;
    if (backgroundJobHandler.isStalling || user.job.isRunning || !hasStaleData) {
      console.log(`Retrieving all known releases for ${user.profile.name.toUpperCase()} thus far...`);
      const cachedData = await Cache.retrieveReleasesFromArtists(
        user.followedArtists.ids,
        user.profile.country,
        -env.MAX_RELEASES,
      );
      // TODO: Render a message indicating a stalling/ongoing process
      res.render('timeline', { layout: 'timeline', releases: cachedData, user } as Render.TimelineContext);
      return;
    }

    // Retrieve first batch of releases
    console.log('Scheduling background job...');
    const retrieval = await backgroundJobHandler.addJob(new SpotifyJob(session._id, user, spotifyToken));
    console.log('First run completed.');

    // Forward any errors to the centralized handler
    if (retrieval.errors.length > 0) {
      console.log('Some errors were encountered in the first run.');
      next(retrieval);
      return;
    }

    // In the best-case scenario when there are no errors,
    // respond to the user as soon as possible.
    res.render('timeline', { layout: 'timeline', releases: retrieval.releases, user } as Render.TimelineContext);
    console.log('Sent the response to the user.');
  })
  .get('/logout', async (req, res) => {
    // Shorthand for session object
    const { session } = req;

    // Log the user out of their session
    if (session)
      await Session.destroy(session);

    res.clearCookie('sid', defaultCookieOptions);
    res.clearCookie('mode', defaultCookieOptions);
    res.redirect('/');
  })
  .get('/login', async (req, res) => {
    // Shorthand for session object
    const { session } = req;

    // Deflect this route for anyone who is already logged in
    if (session && 'userID' in session) {
      res.redirect('/timeline');
      return;
    }

    // Generate new session
    const newSession = await Session.initialize();
    console.log(`Login Attempt: ${newSession._id}`);
    console.log(`State Hash: ${newSession.loginNonce}`);
    console.log(`Code Verifier: ${newSession.codeVerifier}`);

    // Only keep uninitialized log-in sessions for five minutes
    const options = { ...defaultCookieOptions, maxAge: ONE_MINUTE * 5 };
    res.cookie('sid', newSession._id, options);
    res.cookie('mode', 'login', options);
    console.log('Temporary session cookie set.');

    res.redirect(SpotifyAPI.generateAuthEndpoint(newSession.loginNonce, newSession.codeVerifier));
  })
  .get('/callback', async (req: express.Request<Record<string, string>, unknown, unknown, AuthorizationResult>, res, next) => {
    const { session: oldSession } = req;

    // Deflect users without session details
    if (!oldSession) {
      console.log('Deflecting user without any session details whatsoever...');
      res.redirect('/');
      return;
    }

    // Deflect users who are already logged in
    if ('userID' in oldSession) {
      console.log('Deflecting user who is already logged in...');
      res.redirect('/timeline');
      return;
    }

    // Deflect all requests with invalid `state` parameters
    const authorization = req.query;
    if (!authorization.state || authorization.state !== oldSession.loginNonce) {
      console.log('Invalid login attempt.');
      console.log(`Spotify State: ${authorization.state ?? 'NONE_RECEIVED'}`);
      console.log(`Login Nonce: ${oldSession.loginNonce}`);
      res.redirect('/logout');
      return;
    }

    // Handle the authorization error elsewhere
    if ('error' in authorization || 'error_description' in authorization) {
      console.log('Errors were found in the callback query parameters.');
      if (authorization.error === 'access_denied')
        res.redirect('/');
      else
        // eslint-disable-next-line node/callback-return
        next(new OAuthError(401, authorization));
      return;
    }

    // Exchange the authorization code for an access token
    const tokenResult = await SpotifyAPI.init(authorization.code, oldSession.codeVerifier);

    // Handle any initialization errors elsewhere
    if (!tokenResult.ok) {
      console.log('Failed to initialize Spotify API fetcher.');
      next(tokenResult.error);
      return;
    }

    // Initialize reference to Spotify API
    console.log('Spotify API fetcher initialized.');
    const api = tokenResult.value;

    // Initialize the user object
    const userResult = await api.fetchUserProfile();

    // Handle the first-pull fetch error elsewhere
    if (!userResult.ok) {
      console.log('Failed to fetch user profile.');
      next(userResult.error);
      return;
    }

    // Check if the user has previously logged in to the service
    console.log('User profile fetched.');
    req.user = await Cache.retrieveUser(userResult.value._id);

    // Initialize the new user otherwise
    if (!req.user) {
      console.log('Initializing new user...');
      req.user = {
        ...userResult.value,
        followedArtists: {
          ids: [],
          retrievalDate: -Infinity,
        },
        job: {
          isRunning: false,
          dateLastDone: -Infinity,
        },
      };
      await Cache.upsertUserObject(req.user);
    } else {
      console.log('Found returning user.');
      req.user.profile = userResult.value.profile;
      await Cache.updateUserProfile(req.user);
    }

    // Initialize new session data
    const token = api.tokenInfo;
    const newSession = await Session.upgrade(oldSession, {
      userID: req.user._id,
      token: { spotify: token },
      pendingTokenUpdates: [],
    });
    req.session = newSession;

    // Compute `maxAge`
    const remainingTime = token.expiresAt - Date.now();
    const remainingSeconds = Math.floor(remainingTime / 1e3);

    // Set relevant cookies
    const options = { ...defaultCookieOptions, maxAge: ONE_DAY * 14 - remainingSeconds };
    res.cookie('sid', newSession._id, options);
    res.cookie('mode', 'session', options);
    res.redirect('/timeline');
  })
  .get('/error', async (req: express.Request<Record<string, string>, unknown, unknown, { type: string; hasTimeline: string }>, res) => {
    const { user } = req;
    if (!user) {
      res.redirect('/');
      return;
    }

    const { type } = req.query;
    const hasTimeline = Boolean(parseInt(req.query.hasTimeline));
    const renderContext: Render.TimelineContext = {
      layout: 'timeline',
      user,
      releases: await Cache.retrieveReleasesFromArtists(
        user.followedArtists.ids,
        user.profile.country,
        -env.MAX_RELEASES,
      ),
    };

    switch (type) {
      case 'ACCESS_DENIED':
        renderContext.highestSeverityError = new OAuthError(401, { error: 'access_denied', error_description: 'Test' }, API_ERROR_TYPES.ACCESS_DENIED);
        break;
      case 'NOT_FOUND':
        renderContext.highestSeverityError = new SpotifyAPIError({ status: 404, message: 'Not found.' }, 0);
        break;
      case 'FORBIDDEN':
        renderContext.highestSeverityError = new OAuthError(403, { error: 'forbidden', error_description: 'Request rejected.' }, API_ERROR_TYPES.FORBIDDEN);
        break;
      case 'UNAUTHORIZED':
        renderContext.highestSeverityError = new OAuthError(401, { error: 'unauthorized', error_description: 'Lacking permissions.' }, API_ERROR_TYPES.UNAUTHORIZED);
        break;
      case 'NO_PERMISSION':
        renderContext.highestSeverityError = new OAuthError(401, { error: 'unauthorized', error_description: 'Lacking permissions.' }, API_ERROR_TYPES.NO_PERMISSION);
        break;
      case 'REFRESH_FAILED':
        renderContext.highestSeverityError = new OAuthError(400, { error: 'refresh_failed', error_description: 'Unexpected refresh failure.' }, API_ERROR_TYPES.REFRESH_FAILED);
        break;
      case 'INIT_FAILED':
        renderContext.highestSeverityError = new OAuthError(400, { error: 'init_failed', error_description: 'Unexpected init failure.' }, API_ERROR_TYPES.INIT_FAILED);
        break;
      case 'RATE_LIMIT':
        renderContext.highestSeverityError = new SpotifyAPIError({ status: 429, message: 'Too many requests.' }, 300);
        break;
      case 'EXTERNAL_ERROR':
        renderContext.highestSeverityError = new SpotifyAPIError({ status: 500, message: 'Server error.' }, 60);
        break;
      default:
        renderContext.highestSeverityError = new SpotifyAPIError({ status: 200, message: 'Unknown error?' }, 1000);
        break;
    }

    if (hasTimeline)
      res.render('timeline', renderContext);
    else
      res.render('error', { layout: 'error', error: renderContext.highestSeverityError } as Render.ErrorContext);
  });

export { router as coreHandler };
