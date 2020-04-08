import 'express';
declare global {
  namespace Express {
    interface Session {
      token?: { spotify: SpotifyAccessToken };
      isLoggedIn?: boolean;
      followedArtists?: {
        /** List of cached Spotify artist IDs. */
        ids: string[];
        /** Last retrieval date (in milliseconds since UNIX epoch). */
        retrievalDate: number;
      };
    }
  }
}
