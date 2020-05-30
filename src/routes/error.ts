// DEPENDENCIES
import express from 'express';

// MIDDLEWARES
import {
  handleFirstPullErrors,
  handleReleaseRetrievalErrors,
} from '../middlewares/error';

// GLOBAL VARIABLES
const router = express.Router();

router
  .use(handleReleaseRetrievalErrors)
  .use(handleFirstPullErrors);

export { router as errorHandler };
