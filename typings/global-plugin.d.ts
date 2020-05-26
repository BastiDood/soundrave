import 'express';

type OAuthError = import('../src/errors/OAuthError').OAuthError;
type SpotifyAPIError = import('../src/errors/SpotifyAPIError').SpotifyAPIError;

declare global {
  namespace Render {
    export interface HomeContext {
      layout: 'home';
      isLoggedIn: boolean;
    }

    export interface TimelineContext {
      releases: PopulatedReleaseObject[];
      user: UserObject;
      highestSeverityError?: OAuthError|SpotifyAPIError;
    }
  }

  namespace Express {
    export interface Request {
      session: ValidSessionObject|LoginSessionObject|null;
      signedCookies: {
        sid?: string;
        mode?: string;
      };
      user: UserObject|null;
    }
  }
}
