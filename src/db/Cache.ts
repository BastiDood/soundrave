// NODE CORE IMPORTS
import { strict as assert } from 'assert';

// MODELS
import { User, Artist, Release } from './models';

export class Cache {
  static async upsertUserObject(user: UserObject): Promise<void> {
    const result = await User
      .findByIdAndUpdate(user._id, user, { upsert: true })
      .exec();
    assert(result);
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

  static async deleteUserObject({ _id }: UserObject): Promise<void> {
    const result = await User
      .findByIdAndDelete(_id)
      .exec();
    assert(result);
  }

  static async upsertArtistObject(artist: ArtistObject): Promise<void> {
    const result = await Artist
      .findByIdAndUpdate(artist._id, artist, { upsert: true })
      .exec();
    assert(result);
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
    const result = await Release
      .findByIdAndUpdate(release._id, release, { upsert: true })
      .exec();
    assert(result);
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
        artists: { $in: ids },
        availableCountries: countryCode,
      })
      .sort({ releaseDate: -1 })
      .limit(limit)
      .lean()
      .populate('artists')
      .exec();
  }

  static async updateUserProfile({ _id, profile }: UserObject): Promise<void> {
    const result = await User
      .findByIdAndUpdate(_id, { $set: { profile } })
      .exec();
    assert(result);
  }

  static async updateJobStatusForUser({ _id, job }: UserObject): Promise<void> {
    const result = await User
      .findByIdAndUpdate(_id, { $set: { job } })
      .exec();
    assert(result);
  }

  static async updateFollowedArtistsByUserObject({ _id, followedArtists }: UserObject): Promise<void> {
    const result = await User
      .findByIdAndUpdate(_id, { $set: { followedArtists } })
      .exec();
    assert(result);
  }

  static async updateFollowedArtistsByID(id: string, followedArtists: FollowedArtistsInfo): Promise<void> {
    const result = await User
      .findByIdAndUpdate(id, { $set: { followedArtists } })
      .exec();
    assert(result);
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
