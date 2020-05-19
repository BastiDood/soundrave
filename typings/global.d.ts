import './api';
import './auth';
import './mongo';
import './token';
import './util';

interface BaseRetrieval {
  errors: import('../src/errors/SpotifyAPIError').SpotifyAPIError[];
}

declare global {
  interface BaseSession {
    /** Spotify ID of the current user */
    userID?: string;
    token?: { spotify: SpotifyAccessToken };
    /** Nonce to be used during first log in. This is to be disposed of after logging in. */
    loginNonce?: string;
  }

  interface ArtistsRetrieval extends BaseRetrieval {
    artists: ArtistObject[];
  }

  interface ReleasesRetrieval extends BaseRetrieval {
    releases: PopulatedReleaseObject[];
  }
}
