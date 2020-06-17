// NODE CORE IMPORTS
import { strict as assert } from 'assert';

// MODELS
import { Cache } from '../../db/Cache';
import { Session } from '../../db/Session';

// ERRORS
import { OAuthError, SpotifyAPIError, API_ERROR_TYPES } from '../../errors';

// TYPES
import type { Request, Response, NextFunction } from 'express';

// GLOBAL VARIABLES
const defaultCookieOptions: import('express').CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  signed: true,
};

export const handleFirstPullErrors = async (error: OAuthError|SpotifyAPIError|Error, req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!(error instanceof OAuthError) || !(error instanceof SpotifyAPIError)) {
    next(error);
    return;
  }

  const { session, user } = req;
  assert(session);
  assert(user);

  // Delete cookies when session reset is necessary
  if (error.type === API_ERROR_TYPES.INIT_FAILED
    || error.type === API_ERROR_TYPES.REFRESH_FAILED
    || error.type === API_ERROR_TYPES.NO_PERMISSION
    || error.type === API_ERROR_TYPES.UNAUTHORIZED
    || error.type === API_ERROR_TYPES.FORBIDDEN
    || error.type === API_ERROR_TYPES.NOT_FOUND
  ) {
    await Session.destroy(session);
    res.clearCookie('sid', defaultCookieOptions);
    res.clearCookie('mode', defaultCookieOptions);
  }

  // Delete user profile when user data reset is necessary
  if (error.type === API_ERROR_TYPES.NOT_FOUND)
    await Cache.deleteUserObject(user);

  res.status(error.status).render('error', { layout: 'error', error } as Render.ErrorContext);
};
