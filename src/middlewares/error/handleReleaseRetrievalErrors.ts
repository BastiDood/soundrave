// NODE CORE IMPORTS
import { strict as assert } from 'assert';

// TYPES
import type { Request, Response, NextFunction } from 'express';
import { OAuthError } from '../../errors/OAuthError';
import type { SpotifyAPIError } from '../../errors/SpotifyAPIError';

export const handleReleaseRetrievalErrors = (err: ReleasesRetrieval|Error, req: Request, res: Response, next: NextFunction): void => {
  const { user } = req;
  assert(user);

  if ('releases' in err && 'errors' in err) {
    const { releases, errors } = err;
    assert(errors.length > 0);
    const context: Render.TimelineContext = { releases, user };

    // Find the highest severity error and present it to the user
    const { oauth, api } = errors.reduce((prev, curr) => {
      if (curr instanceof OAuthError)
        prev.oauth.push(curr);
      else
        prev.api.push(curr);
      return prev;
    }, { oauth: [] as OAuthError[], api: [] as SpotifyAPIError[] });

    // eslint-disable-next-line no-extra-parens
    const highestSeverityReducer = <T extends OAuthError|SpotifyAPIError>(prev: T, curr: T): T => (curr.status > prev.status ? curr : prev);
    if (oauth.length > 0)
      context.highestSeverityError = oauth.reduce(highestSeverityReducer);
    else
      context.highestSeverityError = api.reduce(highestSeverityReducer);

    res.status(context.highestSeverityError.status).render('timeline', context);
    return;
  }

  next(err);
};
