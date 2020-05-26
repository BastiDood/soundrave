// MODELS
import { Cache } from '../../db/Cache';
import { Session } from '../../db/Session';

// TYPES
import type { NextFunction } from 'express';

// @ts-expect-error
export const populateSessionData = async (req: Express.Request, res: Express.Response, next: NextFunction): Promise<void> => {
  // Initialize session object
  req.session = null;
  req.user = null;

  // Skip any requests without any signed cookies
  console.log('Populating session data...');
  const { sid, mode } = req.signedCookies;
  if (sid && (mode === 'session' || mode === 'login'))
    req.session = await Session.check(mode, sid);

  // Populate the `user` field for convenience
  if (req.session && 'userID' in req.session)
    req.user = await Cache.retrieveUser(req.session.userID);

  next();
};
