// NODE CORE IMPORTS
import { createHash, randomBytes } from 'crypto';
import { strict as assert } from 'assert';
import { promisify } from 'util';

// DEPENDENCIES
import express from 'express';

// LOADERS
import { backgroundJobHandler } from '../loaders/backgroundJobHandler';
import { env } from '../loaders/env';

// CONTROLLERS
import { DataController, SpotifyJob } from '../controllers';

// CACHE
import { Cache } from '../db/Cache';

// FETCHERS
import { SpotifyAPI } from '../fetchers/Spotify';

// ERRORS
import { SpotifyAPIError } from '../errors/SpotifyAPIError';

// UTILITY FUNCTIONS
const generate16RandomBytes = promisify(randomBytes.bind(null, 16));

// GLOBAL VARIABLES
const CACHE_CONTROL_OPTIONS = [ 'private', `max-age=${60 * 60}` ].join(',');
const router = express.Router();

router
  .get('/', (req, res) => {
    // Partially change the home page to invite logged-in user to view their timeline
    // instead of the big login button
    if (req.session?.userID && req.session.token)
      // TODO: Greet the user by name instead
      res.render('index', { layout: 'home', isLoggedIn: true });
    else
      res.render('index', { layout: 'home', isLoggedIn: false });
  })
  .get('/timeline', async (req, res, next) => {
    // Shorthand for session object
    const { session } = req;

    // Reject all users that have not been logged in
    if (!session?.userID || !session?.token) {
      console.log(`Received a user that is not logged in: ${req.sessionID}`);
      res.redirect('/');
      return;
    }

    // TODO: Somehow update the access token here
    // Synchronize the session user object with the database user object
    const user = await Cache.retrieveUser(session.userID);
    assert(user);

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

    // TODO: Figure out how to notify the route-level on `maxAge` changes
    // Retrieve first batch of releases
    console.log('Scheduling background job...');
    const retrieval = await backgroundJobHandler.addJob(new SpotifyJob(user, session.token.spotify, env.MAX_RELEASES));
    console.log('First run completed.');

    // Forward any errors to the centralized handler
    if (retrieval.errors.length > 0) {
      console.log('Some errors were encountered in the first run.');
      next(retrieval);
      return;
    }

    // In the best-case scenario when there are no errors,
    // respond to the user as soon as possible.
    res.setHeader('Cache-Control', CACHE_CONTROL_OPTIONS);
    res.render('timeline', { releases: retrieval.releases, user });
    console.log('Sent the response to the user.');
  })
  .get('/logout', async (req, res) => {
    // Block this route to those who have not logged in yet
    const { session } = req;
    if (!session?.userID || !session?.token) {
      res.sendStatus(404);
      return;
    }

    // Log the user out of their session
    await promisify(session.destroy.bind(session))();
    res.redirect('/');
  })
  .get('/login', async (req, res) => {
    // Block this route for anyone who is already logged in
    const { session } = req;
    if (req.session?.userID && req.session?.token) {
      res.sendStatus(404);
      return;
    }

    assert(session);
    assert(req.sessionID);

    // Generate nonce for the `state` parameter
    const hash = createHash('md5')
      .update(req.sessionID)
      .update(await generate16RandomBytes())
      .digest('hex');
    console.log(`Login Attempt: ${req.sessionID}`);
    console.log(`State Hash: ${hash}`);

    // Only keep uninitialized log-in sessions for five minutes
    session.cookie.maxAge = 60 * 5;
    session.loginNonce = hash;
    session.touch();
    console.log('Temporary session touched');

    res.redirect(SpotifyAPI.generateAuthEndpoint(hash));
  })
  .get('/callback', async (req: express.Request<{}, {}, {}, AuthorizationResult>, res, next) => {
    const { session: oldSession } = req;
    const authorization = req.query;

    // Deflect all requests with invalid `state` parameters
    const hasExistingState = authorization.state && oldSession?.loginNonce;
    const hasValidState = authorization.state! === oldSession!.loginNonce!;
    if (!hasExistingState || !hasValidState) {
      console.log('Invalid login attempt.');
      console.log(`Spotify State: ${authorization.state}`);
      console.log(`Login Nonce: ${oldSession!.loginNonce}`);
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

    // Generate new session when the user is deemed legit
    console.log('User profile fetched.');
    assert(oldSession);
    await promisify(oldSession.regenerate.bind(oldSession))();
    const { session: newSession } = req;
    assert(newSession);
    console.log('New session generated.');

    // Initialize session data
    const token = api.tokenInfo;
    newSession.token = { spotify: token };
    const remainingMilliseconds = token.expiresAt - Date.now();
    const remainingSeconds = Math.floor(remainingMilliseconds / 1e3);
    newSession.cookie.maxAge = remainingSeconds + 60 * 60 * 24 * 10;
    newSession.touch();
    console.log('New session touched');

    // Check if the user has previously logged in to the service
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

    // Store the user object to the session cache
    newSession.userID = user._id;
    res.redirect('/timeline');
  });

export { router as coreHandler };
