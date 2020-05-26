import './api.d.ts';
import './auth.d.ts';
import './mongo.d.ts';
import './token.d.ts';
import './util.d.ts';

type OAuthError = import('../src/errors/OAuthError').OAuthError;
type SpotifyAPIError = import('../src/errors/SpotifyAPIError').SpotifyAPIError;
interface BaseRetrieval {
  errors: (OAuthError|SpotifyAPIError)[];
}

declare global {
  interface ArtistsRetrieval extends BaseRetrieval {
    artists: ArtistObject[];
  }

  interface ReleasesRetrieval extends BaseRetrieval {
    releases: PopulatedReleaseObject[];
  }
}
