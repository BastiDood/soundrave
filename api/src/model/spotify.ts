import { z } from 'zod';

function createCursorPagingObject<T>(schema: z.ZodSchema<T>) {
    return z.object({
        next: z.string().url().nullable(),
        items: schema.array(),
    });
}

export const ApiError = z.object({
    status: z.number().positive().int(),
    message: z.string(),
});

const Image = z.object({
    height: z.number().positive().int().nullable(),
    width: z.number().positive().int().nullable(),
    url: z.string().url(),
});

export const User = z.object({
    id: z.string().nonempty(),
    country: z.string().nonempty(),
    display_name: z.string().nonempty(),
    images: Image.array(),
    type: z.literal('user'),
});

const Artist = z.object({
    id: z.string().nonempty(),
    name: z.string().nonempty(),
    images: Image.array(),
    type: z.literal('artist'),
});

const Album = z.object({
    id: z.string().nonempty(),
    name: z.string().nonempty(),
    album_type: z.enum(['album', 'single', 'compilation']),
    available_markets: z.string().length(2).array(),
    release_date: z.string().nonempty(),
    release_date_precision: z.enum(['year', 'month', 'day']),
    images: Image.array(),
    type: z.literal('album'),
});

export const UserInfo = User.or(ApiError);
export const FollowedArtists = createCursorPagingObject(Artist).or(ApiError);
export const ArtistAlbums = createCursorPagingObject(Album).or(ApiError);
