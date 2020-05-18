// DEPENDENCIES
import { SafeString } from 'handlebars';

// FETCHERS
import { SpotifyAPI } from '../../fetchers/Spotify';

// UTILITY FUNCTIONS
import { formatEndpoint } from '../../util';

// TYPES
type ResourceType = 'album'|'artist';

// GLOBAL VARIABLES
const transformLinkByType = (type: ResourceType) =>
  (id: string): string => formatEndpoint(SpotifyAPI.RESOURCE_ENDPOINT, `/${type}/${id}`);
const toArtistLink = transformLinkByType('artist');
const toReleaseLink = transformLinkByType('album');

export function spotifyLink(type: ResourceType, id: string, name: string): SafeString {
  const generateAnchorTag = (link: string): SafeString => new SafeString(`<a href="${link}" title="${name}">${name}</a>`);
  if (type === 'artist')
    return generateAnchorTag(toArtistLink(id));
  return generateAnchorTag(toReleaseLink(id));
}
