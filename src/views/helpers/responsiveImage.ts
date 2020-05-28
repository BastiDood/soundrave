import { strict as assert } from 'assert';
import { SafeString } from 'handlebars';

/**
 * This function relies on the fact that the Spotify API
 * always returns image objects in descending order by
 * image width.
 */
export function responsiveImage(alt: string, images: SpotifyApi.ImageObject[]): SafeString {
  assert(images.every(img => img.height && img.width));
  const fallback = images[images.length - 1];
  return new SafeString(`<img
    src="${fallback.url}"
    srcset="${images.map(img => `${img.url} ${img.width!}w`).join(',')}"
    sizes="(min-width: 300px) 80px,
      (min-width: 360px) 100px,
      (min-width: 5000px) 640px,
      55px"
    alt="${alt}"
    class="block"
  />`);
}
