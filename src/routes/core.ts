// NODE CORE IMPORTS
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

// GLOBAL VARIABLES
const ONE_DAY = 24 * 60 * 60 * 1e3;
const CACHE_CONTROL_OPTIONS = [ 'private', `max-age=${ONE_DAY / 1e3}` ].join(',');
const router = express.Router();

router
  .get('/', async (req, res, next) => {
    // Set `Cache-Control` directives
    res.setHeader('Cache-Control', CACHE_CONTROL_OPTIONS);

    // Shorthand for session object
    const { session } = req;

    // Reject all users that have not been logged in
    if (!session?.userID || !session?.token) {
      console.log(`Received a user that is not logged in: ${session?.sessionID}`);
      res.render('init');
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
        env.MAX_RELEASES,
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
  .get('/login', ({ session }, res) => {
    if (session?.user && session?.token)
      res.sendStatus(404);
    else
      res.redirect(SpotifyAPI.AUTH_ENDPOINT);
  })
  .get('/callback', async (req: express.Request<{}, {}, {}, AuthorizationResult>, res) => {
    const authorization = req.query;

    // TODO: Check if request is from Spotify accounts using `state` parameter
    // Check if authorization code exists
    if (!req.session || !('code' in authorization)) {
      res.sendStatus(404);
      return;
    }

    // Exchange the authorization code for an access token
    const tokenResult = await SpotifyAPI.init(authorization.code);

    // TODO: Handle any authorization errors
    assert(tokenResult.ok);

    // Generate new session when the user logs in
    await promisify(req.session.regenerate.bind(req.session))();
    const { session } = req;

    // Initialize reference to Spotify API
    const api = tokenResult.value;

    // Initialize session data
    const token = api.tokenInfo;
    session.token = { spotify: token };
    const remainingTime = token.expiresAt - Date.now();
    session.cookie.maxAge = remainingTime + ONE_DAY * 10;

    // Initialize the user object
    const userResult = await api.fetchUserProfile();

    // TODO: Handle errors when initializing the user profile
    assert(userResult.ok);

    // Check if the user has previously logged in to the service
    let user = await Cache.retrieveUser(userResult.value._id);

    // Initialize the new user otherwise
    const saveOperations: Promise<void>[] = [];
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
      saveOperations.push(Cache.upsertUserObject(user));
    } else {
      user.profile = userResult.value.profile;
      saveOperations.push(Cache.updateUserProfile(user));
    }

    // Store the user object to the session cache
    session.userID = user._id;

    // Explicitly save session data due to redirect
    saveOperations.push(promisify(session.save.bind(session))());
    await Promise.all(saveOperations);

    // TODO: Handle error if `error in authorization`

    res.redirect('/');
  });

export { router as coreHandler };
