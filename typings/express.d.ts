import { Request } from 'express';

type OAuthError = import('../src/errors/OAuthError').OAuthError;
type SpotifyAPIError = import('../src/errors/SpotifyAPIError').SpotifyAPIError;
type API_ERROR_TYPES = import('../src/errors/ErrorTypes').API_ERROR_TYPES;

interface AgentInfo {
  isBrowserSupported: boolean;
  device: 'desktop'|'mobile'|'other';
}

interface CookieInfo {
  sid?: string;
  mode?: string;
}

declare global {
  namespace Express {
    interface Request {
      agent: AgentInfo;
      session: ValidSessionObject|LoginSessionObject|null;
      signedCookies: CookieInfo;
      user: UserObject|null;
    }
  }
}
