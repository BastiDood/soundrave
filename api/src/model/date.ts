import { z } from 'zod';

const YearPreciseSchema = z.object({
    precision: z.literal('year'),
    year: z.number().positive().int(),
});

const MonthPreciseSchema = YearPreciseSchema.extend({
    precision: z.literal('month'),
    month: z.number().positive().int(),
});

const DayPreciseSchema = MonthPreciseSchema.extend({
    precision: z.literal('day'),
    day: z.number().positive().int(),
});

export const SpotifyDateSchema = z.union([YearPreciseSchema, MonthPreciseSchema, DayPreciseSchema]);

export type SpotifyDate = z.infer<typeof SpotifyDateSchema>;
