import './api.d.ts';
import './auth.d.ts';
import './mongo.d.ts';
import './token.d.ts';
import './util.d.ts';

interface ReleaseRetrieval {
  releases: PopulatedReleaseObject[];
  errors: import('../src/errors/SpotifyAPIError').SpotifyAPIError[];
}
