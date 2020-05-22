// DEPENDENCIES
import { model } from 'mongoose';

// LOADERS
// import { cacheDB, sessionDB } from '../../loaders/db';

// SCHEMAS
import { UserSchema, ArtistSchema, ReleaseSchema } from '../schemas';

export const User = model<MongoUserObject>('User', UserSchema);
export const Artist = model<MongoArtistObject>('Artist', ArtistSchema);
export const Release = model<MongoNonPopulatedReleaseObject>('Release', ReleaseSchema);
// export const Session = model('Session', SessionSchema);
