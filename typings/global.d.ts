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

interface Authorization {
  /** The value of the `state` parameter supplied in the request. */
  state?: string;
}

interface AuthorizationSuccess extends Authorization {
  /** An authorization code that can be exchanged for an access token. */
  code: string;
}

interface AuthorizationError extends Authorization {
  /** The reason authorization failed, for example: `access_denied`. */
  error: string;
}

declare type AuthorizationResult = AuthorizationSuccess|AuthorizationError;

declare interface SpotifyAccessToken {
  accessToken: string;
  refreshToken: string;
  scope: string[];
  /** Expiry date (in milliseconds since Unix Epoch) */
  expiresAt: number;
}

interface SuccessfulResult<T> {
  ok: true;
  value: T;
}

interface FailedResult<T> {
  ok: false;
  error: T;
}

type Result<SuccessType, FailureType> = SuccessfulResult<SuccessType>|FailedResult<FailureType>;

type MongoDocument = import('mongoose').Document;

interface MongoUserObject extends MongoDocument {
  /** Spotify ID of the user */
  _id: string;
  /** Display name in Spotify */
  name: string;
  /** ISO 3166-1 alpha-2 country code in which the user registered from */
  country: string;
  followedArtists: {
    /** Spotify IDs of the user's followed artists */
    ids: string[];
    /** Represented as milliseconds since Unix time (in milliseconds) */
    retrievalDate: number;
    /** Associated ETag of the list of followed artists */
    etag: string;
  };
  images: SpotifyApi.ImageObject[];
  /** Represented as milliseconds since Unix time (in milliseconds) */
  retrievalDate: number;
}

type UserObject = Pick<MongoUserObject, '_id'|'name'|'country'|'followedArtists'|'images'|'retrievalDate'>;

declare interface MongoArtistObject extends MongoDocument {
  /** Spotify ID of the artist */
  _id: string;
  name: string;
  images: SpotifyApi.ImageObject[];
  /** Represented as milliseconds since Unix time (in milliseconds) */
  retrievalDate: number;
}

type ArtistObject = Pick<MongoArtistObject, '_id'|'name'|'images'|'retrievalDate'>;

interface MongoReleaseObject extends MongoDocument {
  /** Spotify ID of the release */
  _id: string;
  title: string;
  albumType: 'album'|'single'|'compilation';
  /** Represented as milliseconds since Unix time (in milliseconds) */
  releaseDate: number;
  /** Determines precision of date */
  datePrecision: 'year'|'month'|'day';
  /** ISO 3166-1 alpha-2 country codes of countries in which the release is available */
  availableCountries: string[];
  images: SpotifyApi.ImageObject[];
}

type ReleaseObjectKeys = '_id'|'title'|'albumType'|'releaseDate'|'datePrecision'|'availableCountries'|'images'|'artists';

declare interface MongoNonPopulatedReleaseObject extends MongoReleaseObject {
  /** Spotify IDs of artists */
  artists: string[];
}

type NonPopulatedReleaseObject = Pick<MongoNonPopulatedReleaseObject, ReleaseObjectKeys>;

declare interface MongoPopulatedReleaseObject extends MongoReleaseObject {
  /** Spotify object representation of artists */
  artists: ArtistObject[];
}

type PopulatedReleaseObject = Pick<MongoPopulatedReleaseObject, ReleaseObjectKeys>;
