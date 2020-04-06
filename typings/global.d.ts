declare module 'geoip-country' {
  type IPRanges = [ number, number ];
  interface LookupResult {
    /** [ <low IP range>, <high IP range> ] */
    range: [ number, number ];
    /** 2-letter ISO-3166-1 country code */
    country: string;
  }

  /** @param ip - Valid IP address string */
  function lookup(ip: string): LookupResult|null;

  /** @param ip - Valid IP address string */
  function pretty(ip: string): string;
}

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

interface SpotifyAccessToken {
  accessToken: string;
  refreshToken: string;
  scope: string;
  /** Expiry date (in milliseconds since Unix Epoch) */
  expiresAt: number;
  /** ISO 3166-1 alpha-2 Country Code */
  countryCode: string;
}

declare interface ArtistObject {
  /** Spotify ID of the artist */
  _id: string;
  name: string;
  followers: number;
  /** Number between `[0, 100]` that represents artist relevance/popularity */
  popularity: number;
  images: SpotifyApi.ImageObject[];
}

declare interface ReleaseObject {
  /** Spotify ID of the release */
  _id: string;
  title: string;
  albumType: 'album'|'single'|'compilation';
  /** Represented as milliseconds since Unix time (in milliseconds) */
  releaseDate: number;
  /** Determines precision of date */
  datePrecision: 'year'|'month'|'day';
  availableCountries: string[];
  images: SpotifyApi.ImageObject[];
  /** Spotify IDs of artists */
  artists: string[];
}

declare interface PopulatedReleaseObject {
  /** Spotify ID of the release */
  _id: string;
  title: string;
  albumType: 'album'|'single'|'compilation';
  /** Represented as milliseconds since Unix time (in milliseconds) */
  releaseDate: number;
  /** Determines precision of date */
  datePrecision: 'year'|'month'|'day';
  availableCountries: string[];
  images: SpotifyApi.ImageObject[];
  /** Spotify IDs of artists */
  artists: ArtistObject[];
}