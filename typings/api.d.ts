declare interface UserObject extends Omit<MongoUserObject, MongoKeys> { }
declare interface ArtistObject extends Omit<MongoArtistObject, MongoKeys> { }
declare interface NonPopulatedReleaseObject extends Omit<MongoNonPopulatedReleaseObject, MongoKeys> { }
declare interface PopulatedReleaseObject extends Omit<MongoPopulatedReleaseObject, MongoKeys> { }
