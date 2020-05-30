import 'express';

type OAuthError = import('../src/errors/OAuthError').OAuthError;
type SpotifyAPIError = import('../src/errors/SpotifyAPIError').SpotifyAPIError;
type API_ERROR_TYPES = import('../src/errors/ErrorTypes').API_ERROR_TYPES;

declare global {
  namespace Render {
    interface HomeContext {
      layout: 'home';
    }

    interface TimelineContext {
      releases: PopulatedReleaseObject[];
      user: UserObject;
      highestSeverityError?: OAuthError|SpotifyAPIError;
    }

    interface ErrorContext {
      error: OAuthError|SpotifyAPIError;
    }
  }

  namespace Express {
    interface Request {
      session: ValidSessionObject|LoginSessionObject|null;
      signedCookies: {
        sid?: string;
        mode?: string;
      };
      user: UserObject|null;
    }
  }
}
