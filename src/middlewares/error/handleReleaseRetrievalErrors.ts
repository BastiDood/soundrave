// NODE CORE IMPORTS
import { strict as assert } from 'assert';

// UTILITY FUNCTIONS
import { findHighestSeverityError } from '../../util';

// TYPES
import type { Request, Response, NextFunction } from 'express';

export const handleReleaseRetrievalErrors = (err: ReleasesRetrieval|Error, req: Request, res: Response, next: NextFunction): void => {
  const { user } = req;
  assert(user);

  if ('releases' in err && 'errors' in err) {
    const { releases, errors } = err;
    assert(errors.length > 0);
    const context: Render.TimelineContext = { releases, user };

    // Find the highest severity error and present it to the user
    context.highestSeverityError = findHighestSeverityError(errors);

    if (context.highestSeverityError.status)
      res.status(context.highestSeverityError.status);

    res.render('timeline', context);
    return;
  }

  next(err);
};
