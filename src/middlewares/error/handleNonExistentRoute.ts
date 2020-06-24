// ERRORS
import { NavigationError } from '../../errors';

// TYPES
import type { RequestHandler } from 'express';

// @ts-expect-error
export const handleNonExistentRoute: RequestHandler = (req, res): void => {
  res.status(404)
    .render('error', {
      layout: 'error',
      error: new NavigationError(),
    } as Render.ErrorContext);
};
