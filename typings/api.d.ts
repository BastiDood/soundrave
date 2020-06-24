type MongoKeys = Exclude<keyof MongoDocument, '_id'>;

// Cache
interface UserObject extends Omit<MongoUserObject, MongoKeys> { }
interface ArtistObject extends Omit<MongoArtistObject, MongoKeys> { }
interface NonPopulatedReleaseObject extends Omit<MongoNonPopulatedReleaseObject, MongoKeys> { }
interface PopulatedReleaseObject extends Omit<MongoPopulatedReleaseObject, MongoKeys> { }

// Session
interface ValidSessionObject extends Omit<MongoValidSession, MongoKeys> { }
interface LoginSessionObject extends Omit<MongoLoginSession, MongoKeys> { }
