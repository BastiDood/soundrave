import { Bson } from 'mongo';
import { z } from 'zod';

const BaseSession = z.object({
    _id: z.instanceof(Bson.ObjectId),
    expiresAt: z.date(),
});

export const PendingSessionSchema = BaseSession.extend({
    verified: z.literal(false),
    nonce: z.string(),
});

export type PendingSession = z.infer<typeof PendingSessionSchema>;

export const ValidSessionSchema = BaseSession.extend({
    verified: z.literal(true),
    userId: z.string().nonempty(),
    accessToken: z.string().nonempty(),
    refreshToken: z.string().nonempty(),
});

export type ValidSession = z.infer<typeof ValidSessionSchema>;

export const SessionSchema = PendingSessionSchema.or(ValidSessionSchema);

export type Session = PendingSession | ValidSession;
