// MODELS
import { Session } from '../../db/Session';

// TYPES
import type { Request, Response, NextFunction } from 'express';

// @ts-expect-error
export const populateSessionData = async (req: Express.Request & Request, res: Express.Response & Response, next: NextFunction): Promise<void> => {
  // Initialize session object
  req.session = null;

  // Skip any requests without any signed cookies
  const { sid, mode } = req.signedCookies;
  if (sid && (mode === 'session' || mode === 'login'))
    req.session = await Session.check(mode, sid);
  next();
};
