// MODELS
import { Session } from '../../db/Session';

// TYPES
import type { NextFunction } from 'express';

// @ts-expect-error
export const populateSessionData = async (req: Express.Request, res: Express.Response, next: NextFunction): Promise<void> => {
  // Initialize session object
  req.session = null;

  // Skip any requests without any signed cookies
  const { sid, mode } = req.signedCookies;
  if (sid && (mode === 'session' || mode === 'login')) {
    console.log('Populating session data...');
    req.session = await Session.check(mode, sid);
  }

  next();
};
