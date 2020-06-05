import { strict as assert } from 'assert';
import { SafeString } from 'handlebars';

/**
 * This function relies on the fact that the Spotify API
 * always returns image objects in descending order by
 * image width.
 */
export function responsiveImage(alt: string, images: SpotifyApi.ImageObject[]): SafeString {
  assert(images.every(img => img.height && img.width));
  const srcSet = images.map(img => `${img.url} ${img.width!}w`);
  const fallback = images[images.length - 1];
  return new SafeString(`<img
    src="${fallback.url}"
    srcset="${srcSet.join(',')}"
    sizes="(min-width: 200px) 200px,
      (min-width: 5000px) 600px,
      60px"
    alt="${alt}"
    loading="lazy"
  />`);
}
