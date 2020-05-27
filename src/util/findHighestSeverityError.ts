// NODE CORE IMPORTS
import { strict as assert } from 'assert';

// ERRORS
import { OAuthError } from '../errors/OAuthError';

// TYPES
import type { SpotifyAPIError } from '../errors/SpotifyAPIError';

export function findHighestSeverityError(errors: (OAuthError|SpotifyAPIError)[]): OAuthError|SpotifyAPIError {
  let highestSeverityError: OAuthError|SpotifyAPIError|null = null;
  for (const err of errors) {
    // Errors without statuses are, by definitiion, of highest severity
    if (err.status === null) {
      highestSeverityError = err as OAuthError;
      break;
    }

    // Initial run must initialize the baseline severity
    if (!highestSeverityError) {
      highestSeverityError = err;
      continue;
    }

    // Return the current iteration as the highest severity error
    if (highestSeverityError.status === null)
      break;

    // Rank the errors based on status accordingly
    highestSeverityError = err.status > highestSeverityError.status ? err : highestSeverityError;
  }

  assert(highestSeverityError);
  return highestSeverityError;
}
