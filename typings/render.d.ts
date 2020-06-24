declare namespace Render {
  interface HomeContext {
    layout: 'home';
  }

  interface TimelineContext {
    layout: 'timeline';
    releases: PopulatedReleaseObject[];
    user: UserObject;
    highestSeverityError?: OAuthError|SpotifyAPIError;
  }

  interface ErrorContext {
    layout: 'error';
    error: OAuthError|SpotifyAPIError;
  }
}