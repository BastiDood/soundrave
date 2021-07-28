import { z } from 'zod';

export const RawPendingSession = z.object({
    verified: z.literal(false),
    timeToLive: z.number().positive().int(),
    nonce: z.string(),
});

export const RawValidSession = z.object({
    verified: z.literal(true),
    userId: z.string().nonempty(),
    timeToLive: z.number().positive().int(),
    accessToken: z.string().nonempty(),
    refreshToken: z.string().nonempty(),
    expiresAt: z.number().positive().int(),
});
