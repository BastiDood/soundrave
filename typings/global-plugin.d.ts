import 'express';

interface UninitializedSession {
  isLoggedIn?: boolean;
}

interface ValidSession {
  /** Spotify ID of the current user */
  user: UserObject;
  token: { spotify: SpotifyAccessToken };
  isLoggedIn: true;
}

declare global {
  namespace Express {
    interface Session extends UninitializedSession, ValidSession { }
  }
}
