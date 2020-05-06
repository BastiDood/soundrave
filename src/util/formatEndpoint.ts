// NODE CORE IMPORTS
import { posix as path } from 'path';
import { stringify } from 'querystring';
import url from 'url';

/**
 * Format an absolute URL given an endpoint and
 * some query parameters.
 * @param base - Absolute path to serve as the base
 * @param endpoint - Endpoint to be accessed (relative to `base`)
 * @param query - Record representing the query parameters of the request,
 * which will overwrite the query parameters in the base
 */
export function formatEndpoint(base: string, endpoint: string, query?: Record<string, string>): string {
  // Parse the base URL as an object
  const urlBase = url.parse(base);

  // Merge the original query parameters with the new one,
  // which will overwrite the original
  const originalQuery = new url.URLSearchParams(urlBase.query!);
  const originalQueryObj = Object.fromEntries(originalQuery.entries());
  const queryStr = stringify({ ...originalQueryObj, ...query });

  // Derive the new path name by joining the base path name
  // with the specified endpoint
  const newPathname = path.join(urlBase.pathname!, endpoint);

  // Construct the new absolute URL
  return url.resolve(urlBase.href, newPathname) + (queryStr ? `?${queryStr}` : '');
}
