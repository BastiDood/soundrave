/**
 * This enum lists down all the expected errors
 * from the external APIs. They are ranked by
 * severity in ascending order.
 */
export enum API_ERROR_TYPES {
  /** The user actively rejected permission. */
  ACCESS_DENIED,
  /** The client (somehow) requested for a non-existent resource. */
  NOT_FOUND,
  /** An external API rejected the client's request. */
  FORBIDDEN,
  /** The client (somehow) lacks authorization over a resource. */
  UNAUTHORIZED,
  /** The access token's scope (somehow) lacks authorization over a resource. */
  NO_PERMISSION,
  /** The API access token cannot be refreshed. */
  REFRESH_FAILED,
  /** The API access token cannot be initialized. */
  INIT_FAILED,
  /** The client hit the rate limit. */
  RATE_LIMIT,
  /** An external API has experienced an error. */
  EXTERNAL_ERROR,
  /** This occurs in the worst-case scenario. State is probably invalid here. */
  UNKNOWN,
}
