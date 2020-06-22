// DEPENDENCIES
import { SafeString } from 'handlebars';

// ERRORS
import { OAuthError, SpotifyAPIError, NavigationError, API_ERROR_TYPES } from '../../errors';

export function presentErrorDescription(error: OAuthError|SpotifyAPIError|NavigationError): SafeString {
  let description: SafeString;

  if (error instanceof NavigationError)
    description = new SafeString('Hmm... we can\'t seem to find what you\'re looking for.');
  else
    switch (error.type) {
      case API_ERROR_TYPES.EXTERNAL_ERROR:
        description = new SafeString('The Spotify platform is temporarily unavailable. Sorry for the inconvenience! Please try again later.');
        break;
      case API_ERROR_TYPES.RATE_LIMIT:
        description = new SafeString(`Our servers have received so many requests that we have reached the maximum rate at which Spotify allows us to operate. Due to rate limiting, we cannot serve you right now. Please try again ${error instanceof SpotifyAPIError ? `in ${error.retryAfter} seconds. ` : 'later. '}Sorry for the inconvenience!`);
        break;
      case API_ERROR_TYPES.INIT_FAILED:
        description = new SafeString('We have encountered an error while initializing your session. We did not expect this behavior, so we have logged you out just to be safe. You may <a href="/login" rel="noreferrer">log back in</a>, but if this issue still persists, please contact the webmaster.');
        break;
      case API_ERROR_TYPES.REFRESH_FAILED:
        description = new SafeString('We have encountered an error while refreshing your session. We did not expect this behavior, so we have logged you out just to be safe. You may <a href="/login" rel="noreferrer">log back in</a>, but if this issue still persists, please contact the webmaster.');
        break;
      case API_ERROR_TYPES.NO_PERMISSION:
        description = new SafeString('We do not have the permission to access some information about you. You probably tampered with the redirect URL at Spotify. Although we must commend you for your sneaky attempt to fool our servers, we must invalidate your session just to be safe. You may <a href="/login" rel="noreferrer">log back in</a>, but this time, please be careful. However, if you did not expect to see this issue, please contact the webmaster.');
        break;
      case API_ERROR_TYPES.UNAUTHORIZED:
        description = new SafeString('We do not have the permission to access some information about you. You probably tampered with the redirect URL at Spotify. Although we must commend you for your sneaky attempt to fool our servers, we must invalidate your session just to be safe. You may <a href="/login" rel="noreferrer">log back in</a>, but this time, please be careful. However, if you did not expect to see this issue, please contact the webmaster.');
        break;
      case API_ERROR_TYPES.FORBIDDEN:
        description = new SafeString('Spotify has blocked our request to access some information about you. We did not expect this behavior, so we have logged you out just to be safe. You may <a href="/login" rel="noreferrer">log back in</a>, but if this issue still persists, please contact the webmaster.');
        break;
      case API_ERROR_TYPES.NOT_FOUND:
        description = new SafeString('We cannot find some information about your favorite artists. We did not expect this behavior, so we have logged you out just to be safe. As an extra precaution, we have also removed everything we know about you and your profile from our databases. You may <a href="/login" rel="noreferrer">log back in</a>, but if this issue still persists, please contact the webmaster.');
        break;
      case API_ERROR_TYPES.ACCESS_DENIED:
        description = new SafeString('No problem! If you ever change your mind, you\'re always welcome to <a href="/login" rel="noreferrer">sign up</a> again.');
        break;
      default:
        description = new SafeString('We have no idea how you received this error message. Please contact the webmaster immediately. You have found a bug in our system!');
        break;
    }

  return description;
}
