import { z } from 'zod';

function createCursorPagingObject<T>(schema: z.ZodSchema<T>) {
    return z.object({
        next: z.string().url().nullable(),
        items: schema.array(),
    });
}

const ApiErrorSchema = z.object({
    status: z.number().positive().int(),
    message: z.string(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

const ImageSchema = z.object({
    height: z.number().positive().int().nullable(),
    width: z.number().positive().int().nullable(),
    url: z.string().url(),
});

const UserSchema = z.object({
    id: z.string().nonempty(),
    country: z.string().nonempty(),
    display_name: z.string().nonempty(),
    images: ImageSchema.array(),
    type: z.literal('user'),
});

const ArtistSchema = z.object({
    id: z.string().nonempty(),
    name: z.string().nonempty(),
    images: ImageSchema.array(),
    type: z.literal('artist'),
});

const AlbumSchema = z.object({
    id: z.string().nonempty(),
    name: z.string().nonempty(),
    album_type: z.enum(['album', 'single', 'compilation']),
    available_markets: z.string().length(2).array(),
    release_date: z.string().nonempty(),
    release_date_precision: z.enum(['year', 'month', 'day']),
    images: ImageSchema.array(),
    type: z.literal('album'),
});

export const UserInfoSchema = UserSchema.or(ApiErrorSchema);
export type UserInfo = z.infer<typeof UserInfoSchema>;

export const FollowedArtistsSchema = createCursorPagingObject(ArtistSchema).or(ApiErrorSchema);
export type FollowedArtists = z.infer<typeof FollowedArtistsSchema>;

export const ArtistAlbumsSchema = createCursorPagingObject(AlbumSchema).or(ApiErrorSchema);
export type ArtistAlbums = z.infer<typeof ArtistAlbumsSchema>;
