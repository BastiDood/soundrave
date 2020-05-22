// LOADERS
import { cacheDB, sessionDB } from '../../loaders/db';

// SCHEMAS
import { UserSchema, ArtistSchema, ReleaseSchema } from '../schemas/cache';
import { SessionSchema } from '../schemas/session';

export const User = cacheDB.model<MongoUserObject>('User', UserSchema);
export const Artist = cacheDB.model<MongoArtistObject>('Artist', ArtistSchema);
export const Release = cacheDB.model<MongoNonPopulatedReleaseObject>('Release', ReleaseSchema);
export const Session = sessionDB.model<MongoBaseSession>('Session', SessionSchema);
