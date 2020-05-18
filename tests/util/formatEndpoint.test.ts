import { formatEndpoint } from '../../src/util';

describe('Test URL resolvers', () => {
  test('Specify base, path, and query', () => {
    const BASE = 'https://www.google.com';
    const PATH = '/search';
    const QUERY = { q: 'test' };
    const expected = 'https://www.google.com/search?q=test';
    expect(formatEndpoint(BASE, PATH, QUERY)).toBe(expected);
  });

  test('No query', () => {
    const BASE = 'https://api.spotify.com/v1';
    const PATH = '/me/following';
    const expected = 'https://api.spotify.com/v1/me/following';
    expect(formatEndpoint(BASE, PATH)).toBe(expected);
  });

  test('No previous path name', () => {
    const BASE = 'https://api.spotify.com';
    const PATH = '/v1/me/following';
    const expected = 'https://api.spotify.com/v1/me/following';
    expect(formatEndpoint(BASE, PATH)).toBe(expected);
  });

  test('Merge unique query parameters', () => {
    const BASE = 'https://api.spotify.com/v1?include_groups=album%2Csingle';
    const PATH = '/artists/abc123/albums';
    const QUERY = { market: 'PH' };
    const expected = 'https://api.spotify.com/v1/artists/abc123/albums?include_groups=album%2Csingle&market=PH';
    expect(formatEndpoint(BASE, PATH, QUERY)).toBe(expected);
  });

  test('Overwrite base query parameters', () => {
    const BASE = 'https://api.spotify.com/v1?include_groups=album%2Csingle&market=US';
    const PATH = '/artists/abc123/albums';
    const QUERY = { market: 'PH' };
    const expected = 'https://api.spotify.com/v1/artists/abc123/albums?include_groups=album%2Csingle&market=PH';
    expect(formatEndpoint(BASE, PATH, QUERY)).toBe(expected);
  });
});
