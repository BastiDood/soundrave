import { z } from 'zod';
import { UserSchema } from './spotify.ts';

export const ProfileSchema = z.object({
    _id: UserSchema.shape.id,
    country: UserSchema.shape.country,
    displayName: UserSchema.shape.display_name,
    images: UserSchema.shape.images,
    followedArtists: z.string().nonempty().array(),
});

export type Profile = z.infer<typeof ProfileSchema>;
