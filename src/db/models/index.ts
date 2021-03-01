// GLOBALS
import { cacheDB, sessionDB } from '../../globals/db';

// SCHEMAS
import { UserSchema, ArtistSchema, ReleaseSchema } from '../schemas/cache';
import { ValidSessionSchema, LoginSessionSchema } from '../schemas/session';

// Cache
// @ts-expect-error
export const User = cacheDB.model<MongoUserObject>('User', UserSchema);
// @ts-expect-error
export const Artist = cacheDB.model<MongoArtistObject>('Artist', ArtistSchema);
// @ts-expect-error
export const Release = cacheDB.model<MongoNonPopulatedReleaseObject>('Release', ReleaseSchema);

// Session
// @ts-expect-error
export const ValidSession = sessionDB.model<MongoValidSession>('Session', ValidSessionSchema);
// @ts-expect-error
export const LoginSession = sessionDB.model<MongoLoginSession>('Login', LoginSessionSchema);
