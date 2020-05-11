// MODELS
import { User, Artist, Release } from './models';

// TODO: Create specialized methods for updating single fields
// or only retrieving specific fields **for query performance**
// TODO: Ensure that IDs and dates are indexed in MongoDB

export class Cache {
  static async upsertUserObject(user: UserObject): Promise<void> {
    await User
      .findByIdAndUpdate(user._id, user, { upsert: true })
      .exec();
  }

  static async upsertManyUserObjects(users: UserObject[]): Promise<void> {
    const operations = users.map(user => ({
      updateOne: {
        filter: { _id: user._id },
        update: user,
        upsert: true,
      },
    }));
    await User.bulkWrite(operations, { ordered: false });
  }

  static async upsertArtistObject(artist: ArtistObject): Promise<void> {
    await Artist
      .findByIdAndUpdate(artist._id, artist, { upsert: true })
      .exec();
  }

  static async upsertManyArtistObjects(artists: ArtistObject[]): Promise<void> {
    const operations = artists.map(artist => ({
      updateOne: {
        filter: { _id: artist._id },
        update: artist,
        upsert: true,
      },
    }));
    await Artist.bulkWrite(operations, { ordered: false });
  }

  static async upsertReleaseObject(release: NonPopulatedReleaseObject): Promise<void> {
    await Release
      .findByIdAndUpdate(release._id, release, { upsert: true })
      .exec();
  }

  static async upsertManyReleaseObjects(releases: NonPopulatedReleaseObject[]): Promise<void> {
    const operations = releases.map(release => ({
      updateOne: {
        filter: { _id: release._id },
        update: release,
        upsert: true,
      },
    }));
    await Release.bulkWrite(operations, { ordered: false });
  }

  static retrieveUser(id: string): Promise<UserObject|null> {
    return User
      .findById(id)
      .lean()
      .exec();
  }

  static retrieveArtists(ids: string[]): Promise<ArtistObject[]> {
    return Artist
      .find({ _id: { $in: ids } })
      .lean()
      .exec();
  }

  static retrieveReleasesFromArtists(ids: string[], countryCode: string, limit: number): Promise<PopulatedReleaseObject[]> {
    // @ts-ignore
    return Release
      .find({
        availableCountries: countryCode,
        artists: { $in: ids },
      })
      .sort({ releaseDate: -1 })
      .limit(limit)
      .lean()
      .populate('artists')
      .exec();
  }

  static async updateJobStatusForUser({ _id, job }: UserObject): Promise<void> {
    await User
      .findByIdAndUpdate(_id, { $set: { job } })
      .exec();
  }

  static async updateFollowedArtistsByUserObject({ _id, followedArtists }: UserObject): Promise<void> {
    await User
      .findByIdAndUpdate(_id, { $set: { followedArtists } })
      .exec();
  }

  static async updateFollowedArtistsByID(id: string, followedArtists: FollowedArtistsInfo): Promise<void> {
    await User
      .findByIdAndUpdate(id, { $set: { followedArtists } })
      .exec();
  }

  static async updateManyRetrievalDatesForArtists(artists: ArtistObject[]): Promise<void> {
    const operations = artists.map(({ _id, retrievalDate }) => ({
      updateOne: {
        filter: { _id },
        update: { $set: { retrievalDate } },
      },
    }));
    await Artist.bulkWrite(operations, { ordered: false });
  }
}
