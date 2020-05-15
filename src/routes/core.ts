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
const router = express.Router();

router
  .get('/', async (req, res, next) => {
    // Shorthand for session object
    const { session } = req;

    // Reject all users that have not been logged in
    if (!session?.isLoggedIn) {
      console.log('Received a user that is not logged in.');
      res.render('init');
      return;
    }

    // Retrieve first batch of releases
    console.log('Initializing requests...');
    const dataController = new DataController(session);
    const releasesIterator = dataController.getReleases(env.MAX_RELEASES);
    const releasesResult = await releasesIterator.next();

    // Check for any errors on the first request
    assert(typeof releasesResult.done !== 'undefined');
    if (releasesResult.done) {
      // This works on the assumption that if there is an error in the first pull,
      // then the value is certainly a fail-fast error.
      assert(releasesResult.value.length > 0);
      console.log('Encountered a first-pull error.');
      next({ releases: [], errors: releasesResult.value });
      return;
    }

    // Forward any errors to the centralized handler
    if (releasesResult.value.errors.length > 0) {
      next(releasesResult.value);
      return;
    }

    // In the best-case scenario when there are no errors,
    // respond to the user as soon as possible.
    res.render('index', { releases: releasesResult.value.releases });

    // Schedule the rest of the batches to the job handler
    console.log('Scheduling background job...');
    backgroundJobHandler.addJob(new SpotifyJob(session, releasesIterator));
    console.log('Background job successfully scheduled.');
  })
  .get('/login', (req, res) => {
    if (req.session?.isLoggedIn)
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

    // TODO: store user in the request scope
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
    session.user = user;
    session.isLoggedIn = true;

    // Explicitly save session data due to redirect
    saveOperations.push(promisify(session.save.bind(session))());
    await Promise.all(saveOperations);

    // TODO: Handle error if `error in authorization`

    res.redirect('/');
  });

export { router as coreHandler };
