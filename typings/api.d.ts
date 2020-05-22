type MongoKeys = Exclude<keyof MongoDocument, '_id'>;

// Cache
declare interface UserObject extends Omit<MongoUserObject, MongoKeys> { }
declare interface ArtistObject extends Omit<MongoArtistObject, MongoKeys> { }
declare interface NonPopulatedReleaseObject extends Omit<MongoNonPopulatedReleaseObject, MongoKeys> { }
declare interface PopulatedReleaseObject extends Omit<MongoPopulatedReleaseObject, MongoKeys> { }

// Session
declare interface ValidSessionObject extends Omit<MongoValidSession, MongoKeys> { }
declare interface LoginSessionObject extends Omit<MongoLoginSession, MongoKeys> { }
