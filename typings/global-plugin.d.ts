import 'express';
declare global {
  namespace Express {
    interface Session {
      token?: SpotifyAccessToken;
      isLoggedIn?: boolean;
      followedArtists?: {
        ids: string[];
        retrievalDate: number;
      };
    }
  }
}
