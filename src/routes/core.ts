// NODE CORE IMPORTS
import { strict as assert } from 'assert';

// DEPENDENCIES
import express from 'express';

// GLOBALS
import { backgroundJobHandler } from '../globals/backgroundJobHandler';
import { env } from '../globals/env';

// CONTROLLERS
import { DataController, SpotifyJob } from '../controllers';

// CACHE
import { Cache } from '../db/Cache';
import { Session } from '../db/Session';

// FETCHERS
import { SpotifyAPI } from '../fetchers/Spotify';

// ERRORS
import { SpotifyAPIError } from '../errors/SpotifyAPIError';

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
  .get('/', (req, res) => {
    if (!req.session || 'loginNonce' in req.session)
      // Render the usual home page
      res.render('index', { layout: 'home', isLoggedIn: false });
    else
      // Partially change the home page to invite logged-in user to view their timeline
      // instead of the big login button
      res.render('index', { layout: 'home', isLoggedIn: true });
  })
  .get('/timeline', async (req, res, next) => {
    // Shorthand for session object
    const { session } = req;

    // Deflect all users that have not been logged in
    if (!session || 'loginNonce' in session) {
      console.log('Received a user that is not logged in.');
      res.redirect('/');
      return;
    }

    // Synchronize the session user object with the database user object
    const user = await Cache.retrieveUser(session.userID);
    assert(user);

    // Retrieve the access token
    const spotifyToken = session.token.spotify;

    // Synchronize the cookie's `maxAge`
    const remainingTime = spotifyToken.expiresAt - Date.now();
    const remainingSeconds = Math.floor(remainingTime / 1e3);
    const options = { ...defaultCookieOptions, maxAge: ONE_DAY * 14 - remainingSeconds };
    res.cookie('sid', session._id, options);
    res.cookie('mode', 'session', options);

    // Temporarily return all known releases thus far if the user currently has pending jobs
    const hasStaleData = Date.now() > user.job.dateLastDone + DataController.STALE_PERIOD.LAST_DONE;
    if (user.job.isRunning || !hasStaleData) {
      console.log(`Retrieving all known releases for ${user.profile.name.toUpperCase()} thus far...`);
      const cachedData = await Cache.retrieveReleasesFromArtists(
        user.followedArtists.ids,
        user.profile.country,
        -env.MAX_RELEASES,
      );
      // TODO: Render a message indicating an ongoing process
      res.render('timeline', { releases: cachedData, user });
      return;
    }

    // Make sure that the background job handler is not stalling
    if (backgroundJobHandler.isStalling) {
      console.log('Deflecting a user because the background job handler is stalling...');
      // TODO: Render a message indicating a stalling process
      res.render('timeline', { releases: [], user });
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
    res.render('timeline', { releases: retrieval.releases, user });
    console.log('Sent the response to the user.');
  })
  // TODO: Convert this to a POST route
  .get('/logout', async (req, res) => {
    // Shorthand for session object
    const { session } = req;

    // Log the user out of their session
    if (session && 'userID' in session) {
      await Session.destroy(session);
      res.clearCookie('sid', defaultCookieOptions);
      res.clearCookie('mode', defaultCookieOptions);
    }

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

    // Only keep uninitialized log-in sessions for five minutes
    const options = { ...defaultCookieOptions, maxAge: ONE_MINUTE * 5 };
    res.cookie('sid', newSession._id, options);
    res.cookie('mode', 'login', options);
    console.log('Temporary session cookie set.');

    res.redirect(SpotifyAPI.generateAuthEndpoint(newSession.loginNonce));
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
      await Session.destroy(oldSession);
      res.clearCookie('sid');
      res.redirect('/');
      return;
    }

    // Handle the authorization error elsewhere
    if ('error' in authorization || 'error_description' in authorization) {
      console.log('Errors were found in the callback query parameters.');
      next(new SpotifyAPIError({
        status: 403,
        message: `[${authorization.error}]: ${authorization.error_description}`,
      }, 0));
      return;
    }

    // Exchange the authorization code for an access token
    const tokenResult = await SpotifyAPI.init(authorization.code);

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
    let user = await Cache.retrieveUser(userResult.value._id);

    // Initialize the new user otherwise
    if (!user) {
      console.log('Initializing new user...');
      user = {
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
      await Cache.upsertUserObject(user);
    } else {
      console.log('Found returning user.');
      user.profile = userResult.value.profile;
      await Cache.updateUserProfile(user);
    }

    // Initialize new session data
    const token = api.tokenInfo;
    const newSession = await Session.upgrade(oldSession, {
      userID: user._id,
      token: { spotify: token },
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
  });

export { router as coreHandler };
