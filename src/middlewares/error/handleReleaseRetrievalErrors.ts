// TYPES
import type { Request, Response, NextFunction } from 'express';

// @ts-expect-error
export const handleReleaseRetrievalErrors = (err: ReleasesRetrieval|Error, req: Request, res: Response, next: NextFunction): void => {
  if ('releases' in err && 'errors' in err) {
    const { releases, errors } = err;

    // Find the highest severity error and present it to the user
    // eslint-disable-next-line no-extra-parens
    const highestSeverityError = errors.reduce((prev, curr) => (curr.status > prev.status ? curr : prev));
    res.status(highestSeverityError.status).render('index', { releases, highestSeverityError });
    return;
  }

  next(err);
};
