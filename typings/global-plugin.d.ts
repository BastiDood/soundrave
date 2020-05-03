import 'express';

declare global {
  namespace Express {
    interface Session {
      /** Spotify ID of the current user */
      user?: string;
      isLoggedIn?: boolean;
    }
  }
}
