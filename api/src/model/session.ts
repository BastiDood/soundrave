import { Bson } from 'mongo';
import { z } from 'zod';

export const PendingSessionSchema = z.object({
    _id: z.instanceof(Bson.ObjectId),
    verified: z.literal(false),
    timeToLive: z.number().positive().int(),
    nonce: z.string(),
});

export type PendingSession = z.infer<typeof PendingSessionSchema>;

export const ValidSessionSchema = z.object({
    _id: z.instanceof(Bson.ObjectId),
    verified: z.literal(true),
    userId: z.string().nonempty(),
    timeToLive: z.number().positive().int(),
    accessToken: z.string().nonempty(),
    refreshToken: z.string().nonempty(),
    expiresAt: z.number().positive().int(),
});
export type ValidSession = z.infer<typeof ValidSessionSchema>;

export const SessionSchema = PendingSessionSchema.or(ValidSessionSchema);

export type Session = PendingSession | ValidSession;
