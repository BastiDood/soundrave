// NODE CORE IMPORTS
import { strict as assert } from 'assert';

// TYPES
import type { Request, Response, NextFunction } from 'express';

export const handleReleaseRetrievalErrors = (error: ReleasesRetrieval|Error, req: Request, res: Response, next: NextFunction): void => {
  if (!('releases' in error) || !('errors' in error)) {
    next(error);
    return;
  }

  const { user } = req;
  assert(user);
  const { releases, errors } = error;
  assert(errors.length > 0);
  const context: Render.TimelineContext = { layout: 'timeline', releases, user };

  // Find the highest severity error
  // eslint-disable-next-line no-extra-parens
  context.highestSeverityError = errors.reduce((max, curr) => (curr.type > max.type ? curr : max));

  res.render('timeline', context);
};
