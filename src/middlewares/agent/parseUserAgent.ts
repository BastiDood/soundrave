// DEPENDENCIES
import useragent from 'useragent';

// TYPES
import type { Request, Response, NextFunction } from 'express';

// GLOBAL VARIABLES
const OS = {
  DESKTOP: [
    'Windows',
    'Mac OS X',
    'Chrome OS',
    'Linux',
    'Ubuntu',
    'Debian',
    'Fedora',
    'Gentoo',
    'OpenBSD',
    'FreeBSD',
    'Slackware',
  ],
  MOBILE: [
    'Android',
    'iOS',
    'Windows Phone',
    'Windows Mobile',
    'Windows 10 Mobile',
    'BlackBerry OS',
    'Symbian OS',
  ],
};
const BROWSER_MIN: Record<string, number[]|undefined> = {
  'Chrome': [ 57, 0 ],
  'Chrome Mobile': [ 57, 0 ],
  'Edge': [ 16, 0 ],
  'Electron': [ 2, 0 ],
  'Facebook': [ Infinity, Infinity ],
  'Firefox': [ 52, 0 ],
  'IE': [ Infinity, Infinity ],
  'IE Mobile': [ Infinity, Infinity ],
  'Mobile Safari': [ 10, 3 ],
  // TODO: search for compatibility
  'Mobile Safari UI/WKWebView': [ 0, 0 ],
  'Netscape': [ Infinity, Infinity ],
  'Opera': [ 44, 0 ],
  // TODO: search for compatibility
  'Opera Mini': [ 0, 0 ],
  'Other': [ Infinity, Infinity ],
  'Safari': [ 10, 1 ],
  'Samsung Internet': [ 6, 2 ],
  'UC Browser': [ 12, 12 ],
  'WhatsApp': [ 0, 0 ],
  'Yandex Browser': [ 0, 0 ],
};

// @ts-expect-error
export const parseUserAgent = (req: Request, res: Response, next: NextFunction): void => {
  // Set default experience
  req.agent.isBrowserSupported = true;

  const agent = useragent.parse(req.headers['user-agent']);
  const parsed = { browser: agent.family, version: [ Number(agent.major), Number(agent.minor) ], os: agent.os.family };

  // Determine device based on dictionary
  if (OS.MOBILE.includes(parsed.os))
    req.agent.device = 'mobile';
  else if (OS.DESKTOP.includes(parsed.os))
    req.agent.device = 'desktop';
  else
    req.agent.device = 'other';

  // Block **explicitly** unsupported browsers
  const minimumBrowserVersion = BROWSER_MIN[parsed.browser];
  if (
    minimumBrowserVersion
    && (parsed.version[0] < minimumBrowserVersion[0]
    || parsed.version[1] < minimumBrowserVersion[1])
  )
    req.agent.isBrowserSupported = false;

  next();
};
