// MODELS
import { Session } from '../../db/Session';

// UTILITY FUNCTIONS
import { verifyJWT } from '../../util';

// TYPES
import type { NextFunction } from 'express';

// @ts-expect-error
export const populateSessionData = async (req: Express.Request, res: Express.Response, next: NextFunction): Promise<void> => {
  // Initialize session object
  req.session = null;

  // Skip any requests without any signed cookies
  console.log('Checking cookies...');
  const { sid } = req.cookies;
  if (!sid) {
    next();
    return;
  }

  console.log('Verifying JWT...');
  const verifyResult = await verifyJWT(sid, {
    issuer: 'Release Timeline',
    subject: 'spotify',
    audience: [ 'session', 'login' ],
  });

  // Skip invalid tokens
  if (!verifyResult.ok) {
    next();
    return;
  }

  const token = verifyResult.value;
  if (token.aud === 'session' || token.aud === 'login') {
    console.log('Populating session data...');
    req.session = await Session.check(token.aud, token.sid);
  }

  next();
};
