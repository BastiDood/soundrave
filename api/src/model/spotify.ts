import { z } from 'zod';

function createCursorPagingObject<T>(schema: z.ZodSchema<T>) {
    return z.object({
        next: z.string().url().nullable(),
        items: schema.array(),
    });
}

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

export const FollowedArtists = createCursorPagingObject(Artist);
