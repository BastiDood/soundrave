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
const router = express.Router();

router
  .get('/', async (req, res, next) => {
    // Shorthand for session object
    const { session } = req;

    // Reject all users that have not been logged in
    if (!session?.isLoggedIn) {
      res.render('init');
      return;
    }

    // Retrieve the current user
    const user = await Cache.retrieveUser(session.userID);
    assert(user);

    // Retrieve first batch of releases
    const dataController = new DataController(session, user);
    const releasesIterator = dataController.getReleases(env.MAX_RELEASES);
    const releasesResult = await releasesIterator.next();

    // Check for any errors on the first request
    assert(typeof releasesResult.done !== 'undefined');
    if (releasesResult.done) {
      // This works on the assumption that if there is an error in the first pull,
      // then the value is certainly a fail-fast error.
      assert(releasesResult.value);
      next({ releases: [], errors: [ releasesResult.value ] });
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
    backgroundJobHandler.addJob(new SpotifyJob(session, releasesIterator));
  })
  .get('/login', (req, res) => {
    if (req.session?.isLoggedIn)
      res.sendStatus(404);
    else
      res.redirect(SpotifyAPI.AUTH_ENDPOINT);
  })
  .get('/callback', async (req: express.Request<{}, {}, {}, AuthorizationResult>, res, next) => {
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
    // TODO: Adjust this to span multiple days
    session.cookie.maxAge = token.expiresAt - Date.now();

    // Initialize the user object
    const userResult = await api.fetchUserProfile();

    // TODO: Handle errors when initializing the user profile
    assert(userResult.ok);

    // Use the ID as an identifier for future communication
    session.userID = userResult.value._id;

    // Check if the user has previously logged in to the service
    const user = await Cache.retrieveUser(session.userID);

    // Initialize the new user otherwise
    if (!user) {
      const followedArtists = api.fetchFollowedArtists();
      const firstBatch = await followedArtists.next();

      // Handle the case when the initial retrieval fails
      assert(typeof firstBatch.done !== 'undefined');
      if (firstBatch.done) {
        assert(firstBatch.value);
        next({ releases: [], errors: [ firstBatch.value ] });
        return;
      }

      const { resource, etag } = firstBatch.value;
      const newUser: UserObject = {
        ...userResult.value,
        followedArtists: {
          ids: resource!.map(artist => artist._id),
          etag,
          retrievalDate: Date.now(),
        },
        job: {
          isRunning: false,
          dateLastDone: -Infinity,
        },
      };

      await Promise.all([
        Cache.upsertManyArtistObjects(resource!),
        Cache.upsertUserObject(newUser),
      ]);
    }

    // Explicitly save session data due to redirect
    session.isLoggedIn = true;
    await promisify(session.save.bind(session))();

    // TODO: Handle error if `error in authorization`

    res.redirect('/');
  });

export { router as coreHandler };