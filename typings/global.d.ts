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
    user?: UserObject;
    token?: { spotify: SpotifyAccessToken };
  }

  interface ArtistsRetrieval extends BaseRetrieval {
    artists: ArtistObject[];
  }

  interface ReleasesRetrieval extends BaseRetrieval {
    releases: PopulatedReleaseObject[];
  }
}
