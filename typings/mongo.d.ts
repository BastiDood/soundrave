type MongoDocument = import('mongoose').Document;
type SupportedPlatforms = 'spotify';

interface MongoBaseSession extends MongoDocument {
  _id: string;
}

interface MongoValidSession extends MongoBaseSession {
  /** Spotify ID of the current user */
  userID: string;
  token: Record<SupportedPlatforms, AccessToken>;
}

interface MongoLoginSession extends MongoBaseSession {
  /** Nonce to be used during first log in. This is to be disposed of after logging in. */
  loginNonce: string;
}

interface Cacheable {
  /** Represented as milliseconds since Unix time (in milliseconds) */
  retrievalDate: number;
}

interface UserProfileInfo extends Cacheable {
  /** Display name in Spotify */
  name: string;
  /** ISO 3166-1 alpha-2 country code in which the user registered from */
  country: string;
  images: SpotifyApi.ImageObject[];
}

interface FollowedArtistsInfo extends Cacheable {
  /** Spotify IDs of the user's followed artists */
  ids: string[];
  /** Associated ETag of the list of followed artists */
  etag?: string;
}

interface JobStatusInfo {
  /** Represents the state of the associated fetches for this user's data */
  isRunning: boolean;
  /** Represents the amount of time (in UNIX time) since the last time this user finished all jobs */
  dateLastDone: number;
}

declare interface MongoUserObject extends MongoDocument {
  /** Spotify ID of the user */
  _id: string;
  profile: UserProfileInfo;
  followedArtists: FollowedArtistsInfo;
  job: JobStatusInfo;
}

declare interface MongoArtistObject extends MongoDocument, Cacheable {
  /** Spotify ID of the artist */
  _id: string;
  name: string;
  images: SpotifyApi.ImageObject[];
}

declare interface MongoReleaseObject extends MongoDocument {
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

declare interface MongoNonPopulatedReleaseObject extends MongoReleaseObject {
  /** Spotify IDs of artists */
  artists: string[];
}

declare interface MongoPopulatedReleaseObject extends MongoReleaseObject {
  /** Spotify object representation of artists */
  artists: ArtistObject[];
}
