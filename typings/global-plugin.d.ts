import 'express';
declare global {
  namespace Express {
    interface Session {
      token?: { spotify: SpotifyAccessToken };
      isLoggedIn?: boolean;
      followedArtists?: {
        ids: string[];
        retrievalDate: number;
      };
    }
  }
}
