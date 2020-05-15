import './api';
import './auth';
import './mongo';
import './token';
import './util';

interface BaseRetrieval {
  errors: import('../src/errors/SpotifyAPIError').SpotifyAPIError[];
}

declare global {
  interface ArtistsRetrieval extends BaseRetrieval {
    artists: ArtistObject[];
  }

  interface ReleasesRetrieval extends BaseRetrieval {
    releases: PopulatedReleaseObject[];
  }
}
