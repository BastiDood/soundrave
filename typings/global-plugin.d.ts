import 'express';

type OAuthError = import('../src/errors/OAuthError').OAuthError;
type SpotifyAPIError = import('../src/errors/SpotifyAPIError').SpotifyAPIError;

declare global {
  namespace Render {
    interface HomeContext {
      layout: 'home';
      isLoggedIn: boolean;
    }

    interface TimelineContext {
      releases: PopulatedReleaseObject[];
      user: UserObject;
      highestSeverityError?: OAuthError|SpotifyAPIError;
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
