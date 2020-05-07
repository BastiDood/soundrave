// NODE CORE IMPORTS
import assert from 'assert';
import { promisify } from 'util';

// DEPENDENCIES
import express from 'express';

// CONTROLLERS
import { DataController } from '../controllers/DataController';

// FETCHERS
import { SpotifyAPI } from '../fetchers/Spotify';

// CACHE
import { Cache } from '../db/Cache';

// GLOBAL VARIABLES
const router = express.Router();

// TODO: Catch and handle bubbled events

router
  .get('/', async (req, res) => {
    // Shorthand for session object
    const { session } = req;

    // Reject all users that have not been logged in
    if (!session?.isLoggedIn || !session.userID || !session?.token) {
      res.render('index');
      return;
    }

    // Initialize the data controller
    const user = await Cache.retrieveUser(session.userID);
    const dataController = new DataController(session.token.spotify, user!);

    // Retrieve first batch of releases
    const releasesIterator = dataController.getReleases();
    const releasesResult = await releasesIterator.next();

    // TODO: Present errors in a friendly manner
    assert(!releasesResult.done);
    const { releases, errors } = releasesResult.value;
    assert(errors.length < 1);

    // TODO: Schedule the rest of the batches to the job handler
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
    const tokenResult = await SpotifyAPI.init(authorization.code);

    // TODO: Handle any authorization errors
    assert(tokenResult.ok);

    // Generate new session when the user logs in
    await promisify(session.regenerate.bind(session))();

    // Initialize reference to Spotify API
    const api = tokenResult.value;

    // Initialize session data
    session.token = Object.create(null);
    assert(session.token);
    const token = api.tokenInfo;
    session.token.spotify = token;
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

      // TODO: Handle the case when the user has not followed any artists yet
      assert(typeof firstBatch.done !== 'undefined');
      assert(!firstBatch.done);

      const { resource, etag } = firstBatch.value;
      const newUser: UserObject = {
        ...userResult.value,
        followedArtists: {
          ids: resource!.map(artist => artist._id),
          etag,
          retrievalDate: Date.now(),
        },
        hasPendingJobs: false,
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

export { router };
