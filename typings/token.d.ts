declare interface OAuthToken {
  /** An access token that can be provided in subsequent calls, for example to Spotify Web API services. */
  access_token: string;
  /** How the access token may be used: always “Bearer”. */
  token_type: 'Bearer';
  /** A space-separated list of scopes which have been granted for this `access_token`. */
  scope: string;
  /** The time period (in seconds) for which the access token is valid. */
  expires_in: number;
  /** A token that can be sent to the Spotify Accounts service in place of an authorization code. */
  refresh_token: string;
}

declare interface SpotifyAccessToken {
  accessToken: string;
  refreshToken: string;
  scope: string[];
  /** Expiry date (in milliseconds since Unix Epoch) */
  expiresAt: number;
}
