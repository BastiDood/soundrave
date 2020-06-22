// ERRORS
import { NavigationError } from '../../errors';

// TYPES
import type { Request, Response } from 'express';

// @ts-expect-error
export const handleNonExistentRoute = (req: Request, res: Response): void => {
  res.status(404).render('error', { layout: 'error', error: new NavigationError() });
};
