import 'express';

declare global {
  namespace Express {
    interface Session {
      /** Spotify ID of the current user */
      userID?: string;
      token?: { spotify: SpotifyAccessToken };
      isLoggedIn?: boolean;
    }
  }
}
