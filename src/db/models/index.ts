// GLOBALS
import { cacheDB, sessionDB } from '../../globals/db';

// SCHEMAS
import { UserSchema, ArtistSchema, ReleaseSchema } from '../schemas/cache';
import { ValidSessionSchema, LoginSessionSchema } from '../schemas/session';

// Cache
export const User = cacheDB.model<MongoUserObject>('User', UserSchema);
export const Artist = cacheDB.model<MongoArtistObject>('Artist', ArtistSchema);
export const Release = cacheDB.model<MongoNonPopulatedReleaseObject>('Release', ReleaseSchema);

// Session
export const ValidSession = sessionDB.model<MongoValidSession>('Session', ValidSessionSchema);
export const LoginSession = sessionDB.model<MongoLoginSession>('Login', LoginSessionSchema);
