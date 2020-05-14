import './api';
import './auth';
import './mongo';
import './token';
import './util';

declare global {
  interface ReleaseRetrieval {
    releases: PopulatedReleaseObject[];
    errors: import('../src/errors/SpotifyAPIError').SpotifyAPIError[];
  }
}
