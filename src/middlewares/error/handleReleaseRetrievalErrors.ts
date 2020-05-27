// NODE CORE IMPORTS
import { strict as assert } from 'assert';

// TYPES
import type { Request, Response, NextFunction } from 'express';

export const handleReleaseRetrievalErrors = (err: ReleasesRetrieval|Error, req: Request, res: Response, next: NextFunction): void => {
  const { user } = req;
  assert(user);

  if ('releases' in err && 'errors' in err) {
    const { releases, errors } = err;
    assert(errors.length > 0);
    const context: Render.TimelineContext = { releases, user };

    // Find the highest severity error
    context.highestSeverityError = errors.reduce((max, curr) => {
      if (curr.type > max.type)
        return curr;
      return max;
    });

    res.render('timeline', context);
    return;
  }

  next(err);
};
