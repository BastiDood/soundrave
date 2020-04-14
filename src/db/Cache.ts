// MODELS
import { User, Artist, Release } from './models';

// TODO: Handle `ETag` headers for caching

export class Cache {
  static async writeUserObject(user: UserObject): Promise<void> {
    await User
      .findByIdAndUpdate(user._id, user, { upsert: true })
      .lean()
      .exec();
  }

  static async writeArtistObject(artist: ArtistObject): Promise<void> {
    await Artist
      .findByIdAndUpdate(artist._id, artist, { upsert: true })
      .lean()
      .exec();
  }

  static async writeReleaseObject(release: NonPopulatedReleaseObject): Promise<void> {
    await Release
      .findByIdAndUpdate(release._id, release, { upsert: true })
      .lean()
      .exec();
  }

  static async retrieveArtists(ids: string[]): Promise<ArtistObject[]> {
    const artists: ArtistObject[] = await Artist
      .find({ _id: { $in: ids } })
      .lean()
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
      .lean()
      .populate('artists')
      .exec();
    return releases;
  }
}
