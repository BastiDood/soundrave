import { z } from 'zod';

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
    day: z.number().positive().int(),
});

export const SpotifyDate = z.union([YearPrecise, MonthPrecise, DayPrecise]);
