type OAuthErrorType = import('../src/errors/OAuthError').OAuthError;
type SpotifyAPIErrorType = import('../src/errors/SpotifyAPIError').SpotifyAPIError;

interface BaseRetrieval {
  errors: (OAuthErrorType|SpotifyAPIErrorType)[];
}

interface ArtistsRetrieval extends BaseRetrieval {
  artists: ArtistObject[];
}

interface ReleasesRetrieval extends BaseRetrieval {
  releases: PopulatedReleaseObject[];
}
