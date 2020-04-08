// MODELS
import { Artist, Release } from '../models/Core';

export class Cache {
  static async writeArtistObject(artist: ArtistObject): Promise<void> {
    await Artist
      .findByIdAndUpdate(artist._id, artist, { upsert: true })
      .exec();
  }

  static async writeReleaseObject(release: NonPopulatedReleaseObject): Promise<void> {
    await Release
      .findByIdAndUpdate(release._id, release, { upsert: true })
      .exec();
  }

  static async retrieveArtists(ids: string[]): Promise<ArtistObject[]> {
    // @ts-ignore
    const artists: ArtistObject[] = await Artist
      .find({ _id: { $in: ids } })
      .exec();
    return artists;
  }

  static async retrieveReleasesFromArtists(ids: string[], countryCode: string): Promise<PopulatedReleaseObject[]> {
    // @ts-ignore
    const releases: PopulatedReleaseObject[] = await Release
      .find({
        availableCountries: countryCode,
        artists: { $in: ids },
      })
      .sort({ releaseDate: -1 })
      .populate('artists')
      .exec();
    return releases;
  }
}
