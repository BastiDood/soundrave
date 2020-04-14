// DEPENDENCIES
import mongoose from 'mongoose';

// SCHEMAS
import { UserSchema, ArtistSchema, ReleaseSchema } from '../schemas';

export const User = mongoose.model<MongoUserObject>('User', UserSchema);
export const Artist = mongoose.model<MongoArtistObject>('Artist', ArtistSchema);
export const Release = mongoose.model<MongoNonPopulatedReleaseObject>('Release', ReleaseSchema);
