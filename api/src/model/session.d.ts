import type { Bson } from 'mongo';

interface BaseSession {
    _id: Bson.ObjectId;
    expiresAt: Date;
}

export interface PendingSession extends BaseSession {
    verified: false;
    nonce: string;
}

export interface ValidSession extends BaseSession {
    verified: true;
    userId: string;
    accessToken: string;
    refreshToken: string;
}

export type Session = PendingSession | ValidSession;
