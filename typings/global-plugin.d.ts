import 'express';

declare global {
  namespace Express {
    interface Session {
      token?: { spotify: SpotifyAccessToken };
      isLoggedIn?: boolean;
      cache?: SessionCache;
    }
  }
}
