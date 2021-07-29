import { z } from 'zod';

function createCursorPagingObject<T>(schema: z.ZodSchema<T>) {
    return z.object({
        next: z.string().url().nullable(),
        items: schema.array(),
    });
}

const YearPrecise = z.object({
    precision: z.literal('year'),
    year: z.number().positive().int(),
});

const MonthPrecise = YearPrecise.extend({
    precision: z.literal('month'),
    month: z.number().positive().int(),
});

const DayPrecise = YearPrecise.extend({
    precision: z.literal('day'),
    month: z.number().positive().int(),
});

const SpotifyDate = z.union([YearPrecise, MonthPrecise, DayPrecise]);

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

export const Artist = z.object({
    id: z.string().nonempty(),
    name: z.string().nonempty(),
    images: Image.array(),
    type: z.literal('artist'),
});

export const Album = z.object({
    id: z.string().nonempty(),
    name: z.string().nonempty(),
    album_type: z.enum(['album', 'single', 'compilation']),
    release_date: z.string().nonempty(),
    release_date_precision: z.enum(['year', 'month', 'day']),
    images: Image.array(),
    type: z.literal('album'),
});

export const FollowedArtists = createCursorPagingObject(Artist);
export const ArtistAlbums = createCursorPagingObject(Album);
