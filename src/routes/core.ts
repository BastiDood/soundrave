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
const ONE_DAY = 24 * 60 * 60 * 1e3;
const CACHE_CONTROL_OPTIONS = [ 'private', `max-age=${60 * 60}` ].join(',');
const router = express.Router();

router
  .get('/', async (req, res, next) => {
    // Set `Cache-Control` directives
    res.setHeader('Cache-Control', CACHE_CONTROL_OPTIONS);

    // Shorthand for session object
    const { session } = req;

    // Reject all users that have not been logged in
    if (!session?.userID || !session?.token) {
      console.log(`Received a user that is not logged in: ${req.sessionID}`);
      res.render('init', { layout: 'home' });
      return;
    }

    // TODO: Somehow update the access token here
    // Synchronize the session user object with the database user object
    const user = await Cache.retrieveUser(session.userID);
    assert(user);

    // Temporarily return all known releases thus far if the user currently has pending jobs
    const { isRunning } = user.job;
    if (isRunning) {
      console.log(`Retrieving all known releases for ${user.profile.name.toUpperCase()} thus far...`);
      const cachedData = await Cache.retrieveReleasesFromArtists(
        user.followedArtists.ids,
        user.profile.country,
        -env.MAX_RELEASES,
      );
      // TODO: Render a message indicating an ongoing process
      res.render('index', { releases: cachedData });
      return;
    }

    // Bypass the scheduling of a background job if the cache is still fresh
    const hasStaleData = Date.now() > user.job.dateLastDone + DataController.STALE_PERIOD.LAST_DONE;
    if (!isRunning && !hasStaleData) {
      console.log('Bypassing the scheduling of a background job...');
      const cachedData = await Cache.retrieveReleasesFromArtists(
        user.followedArtists.ids,
        user.profile.country,
        -env.MAX_RELEASES,
      );
      res.render('index', { releases: cachedData });
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
    res.render('index', { releases: retrieval.releases });
    console.log('Sent the response to the user.');
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

    // Only keep uninitialized log-in sessions for five minutes
    session.cookie.maxAge = 60 * 5;
    session.loginNonce = hash;

    console.log(`Login Attempt: ${req.sessionID}`);
    console.log(`State Hash: ${hash}`);
    res.redirect(SpotifyAPI.generateAuthEndpoint(hash));
  })
  .get('/callback', async (req: express.Request<{}, {}, {}, AuthorizationResult>, res, next) => {
    const { session: oldSession } = req;
    const authorization = req.query;

    // Deflect all requests with invalid `state` parameters
    const hasExistingState = authorization.state && oldSession?.loginNonce;
    const hasValidState = authorization.state! === oldSession!.loginNonce!;
    if (!hasExistingState || !hasValidState) {
      res.redirect('/');
      return;
    }

    // Handle the authorization error elsewhere
    if ('error' in authorization || 'error_description' in authorization) {
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
      next(tokenResult.error);
      return;
    }

    // Initialize reference to Spotify API
    const api = tokenResult.value;

    // Initialize the user object
    const userResult = await api.fetchUserProfile();

    // Handle the first-pull fetch error elsewhere
    if (!userResult.ok) {
      next(userResult.error);
      return;
    }

    // Generate new session when the user is deemed legit
    assert(oldSession);
    await promisify(oldSession.regenerate.bind(oldSession))();
    const { session: newSession } = req;
    assert(newSession);

    // Initialize session data
    const token = api.tokenInfo;
    newSession.token = { spotify: token };
    const remainingMilliseconds = token.expiresAt - Date.now();
    const remainingSeconds = Math.floor(remainingMilliseconds / 1e3);
    newSession.cookie.maxAge = remainingSeconds + ONE_DAY / 1e2;

    // Check if the user has previously logged in to the service
    let user = await Cache.retrieveUser(userResult.value._id);

    // Initialize the new user otherwise
    if (!user) {
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
      user.profile = userResult.value.profile;
      await Cache.updateUserProfile(user);
    }

    // Store the user object to the session cache
    newSession.userID = user._id;

    res.redirect('/');
  });

export { router as coreHandler };
