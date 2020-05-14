// DEPENDENCIES
import express from 'express';

// MIDDLEWARES
import { handleReleaseRetrievalErrors } from '../middlewares/error';

// GLOBAL VARIABLES
const router = express.Router();

router
  .use(handleReleaseRetrievalErrors);

export { router as errorHandler };
