import { SafeString } from 'handlebars';

// TODO: Optimize this implementation
export function responsiveImage(alt: string, images: SpotifyApi.ImageObject[]): SafeString {
  // Construct the responsive images
  const srcSets: string[] = [];
  const sizes: string[] = [];
  const fallbackImg = images.reduce((min, curr) => {
    if (!min.width || !min.height)
      return curr;
    else if (!curr.width || !curr.height)
      return min;

    // Fill in the responsive data
    srcSets.push(`${curr.url} ${curr.width}w`);
    sizes.push(`(min-width: ${curr.width + 100}px) ${curr.width}px`);

    // Determine the smallest image
    const minArea = min.width * min.height;
    const currentArea = curr.width * curr.height;
    if (currentArea < minArea)
      return curr;
    return min;
  });

  return new SafeString(`<img
    src="${fallbackImg.url}"
    srcset="${srcSets.join(',')}"
    sizes="${sizes.join(',')}"
    alt="${alt}"
    class="block"
  />`);
}
