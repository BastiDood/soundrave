// TYPES
import type { Request, Response, NextFunction } from 'express';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handleReleaseRetrievalErrors = (err: any, req: Request, res: Response, next: NextFunction): void => {
  if ('releases' in err && 'errors' in err) {
    const { releases, errors } = err as ReleaseRetrieval;

    // Find the highest severity error and present it to the user
    // eslint-disable-next-line no-extra-parens
    const highestSeverityError = errors.reduce((prev, curr) => (curr.status > prev.status ? curr : prev));
    res.status(highestSeverityError.status).render('error', { releases, highestSeverityError });
    return;
  }

  next(err);
};
