// LOADERS
import { cacheDB, sessionDB } from '../../loaders/db';

// SCHEMAS
import { UserSchema, ArtistSchema, ReleaseSchema } from '../schemas/cache';
import { BaseSessionSchema, LoginSessionSchema } from '../schemas/session';

// Cache
export const User = cacheDB.model<MongoUserObject>('User', UserSchema);
export const Artist = cacheDB.model<MongoArtistObject>('Artist', ArtistSchema);
export const Release = cacheDB.model<MongoNonPopulatedReleaseObject>('Release', ReleaseSchema);

// Session
export const BaseSession = sessionDB.model<MongoBaseSession>('Session', BaseSessionSchema);
export const LoginSession = sessionDB.model<MongoLoginSession>('Login', LoginSessionSchema);
