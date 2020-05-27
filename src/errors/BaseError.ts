// DEPENDENCIES
import { SafeString } from 'handlebars';

// ERRORS
import { API_ERROR_TYPES } from './ErrorTypes';

export abstract class BaseError extends Error {
  /** Application-specific code for the error type. */
  readonly type: API_ERROR_TYPES;
  /** HTTP status code received in the failed fetch. */
  readonly status: number;
  /** The human-readable description to be presented in the UI. */
  description: SafeString;

  constructor(status: number, message: string, hint?: API_ERROR_TYPES) {
    super(message);
    this.status = status;

    if (status >= 500)
      this.type = API_ERROR_TYPES.EXTERNAL_ERROR;
    else if (typeof hint !== 'undefined')
      this.type = hint;
    else if (status === 429)
      this.type = API_ERROR_TYPES.RATE_LIMIT;
    else if (status === 404)
      this.type = API_ERROR_TYPES.NOT_FOUND;
    else if (status === 403)
      this.type = API_ERROR_TYPES.FORBIDDEN;
    else if (status === 401)
      this.type = API_ERROR_TYPES.UNAUTHORIZED;
    else
      this.type = API_ERROR_TYPES.UNKNOWN;

    switch (this.type) {
      case API_ERROR_TYPES.EXTERNAL_ERROR:
        this.description = new SafeString('The Spotify platform is temporarily unavailable. Sorry for the inconvenience! Please try again later.');
        break;
      case API_ERROR_TYPES.RATE_LIMIT:
        this.description = new SafeString('Our servers have received so many requests that we have reached the maximum rate at which Spotify allows us to operate. Due to rate limiting, we cannot serve you right now. Sorry for the inconvenience!');
        break;
      case API_ERROR_TYPES.INIT_FAILED:
        this.description = new SafeString('We have encountered an error while initializing your session. We did not expect this behavior, so we have logged you out just to be safe. You may <a href="/login">log back in</a>, but if this issue persists, please contact the webmaster.');
        break;
      case API_ERROR_TYPES.REFRESH_FAILED:
        this.description = new SafeString('We have encountered an error while refreshing your session. We did not expect this behavior, so we have logged you out just to be safe. You may <a href="/login">log back in</a>, but if this issue persists, please contact the webmaster.');
        break;
      case API_ERROR_TYPES.NO_PERMISSION:
        this.description = new SafeString('We do not have the permission to access some information about you. You probably tampered with the redirect URL at Spotify. Although we must commend you for your sneaky attempt to fool our servers, we must invalidate your session just to be safe. You may <a href="/login">log back in</a>, but this time, please be careful. However, if you did not expect to see this issue, please contact the webmaster.');
        break;
      case API_ERROR_TYPES.UNAUTHORIZED:
        this.description = new SafeString('We do not have the permission to access some information about you. You probably tampered with the redirect URL at Spotify. Although we must commend you for your sneaky attempt to fool our servers, we must invalidate your session just to be safe. You may <a href="/login">log back in</a>, but this time, please be careful. However, if you did not expect to see this issue, please contact the webmaster.');
        break;
      case API_ERROR_TYPES.FORBIDDEN:
        this.description = new SafeString('Spotify has blocked our request to access some information about you. We did not expect this behavior, so we have logged you out just to be safe. You may <a href="/login">log back in</a>, but if this issue persists, please contact the webmaster.');
        break;
      case API_ERROR_TYPES.NOT_FOUND:
        this.description = new SafeString('We cannot find some information about your favorite artists. We did not expect this behavior, so we have logged you out just to be safe. As an extra precaution, we have also removed everything we know about you and your profile from our databases. You may <a href="/login">log back in</a>, but if this issue persists, please contact the webmaster.');
        break;
      case API_ERROR_TYPES.ACCESS_DENIED:
        this.description = new SafeString('No problem! If you ever change your mind, you\'re always welcome to <a href="/login">sign up</a> again.');
        break;
      default:
        this.description = new SafeString('We have no idea how you received this error message. Please contact the webmaster immediately. You have found a bug in our system!');
        break;
    }
  }
}
