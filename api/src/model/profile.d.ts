import type { Bson } from 'mongo';
import type { Image } from './spotify.ts';

export interface Profile {
    _id: Bson.ObjectId;
    country: string;
    displayName: string;
    images: Image[];
    followedArtists: string[];
}
