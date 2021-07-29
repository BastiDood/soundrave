import { z } from 'zod';
import { Artist as SpotifyArtist, User } from './spotify.ts';

export const Profile = z.object({
    _id: User.shape.id,
    country: User.shape.country,
    displayName: User.shape.display_name,
    images: User.shape.images,
    followedArtists: z.string().array(),
});
