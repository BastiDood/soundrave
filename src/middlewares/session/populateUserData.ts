// MODELS
import { Cache } from '../../db/Cache';

// TYPES
import type { NextFunction } from 'express';

// @ts-expect-error
export const populateUserData = async (req: Express.Request, res: Express.Response, next: NextFunction): Promise<void> => {
  // Initialize user object
  req.user = null;

  // Skip any requests without any signed cookies
  if (req.session && 'userID' in req.session) {
    console.log('Populating user data...');
    req.user = await Cache.retrieveUser(req.session.userID);
  }

  next();
};
