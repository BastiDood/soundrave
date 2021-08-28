import type { ConnectOptions } from 'mongo';
import type { Profile } from './model/profile.d.ts';
import type { PendingSession, ValidSession, Session } from './model/session.d.ts';

import { encode } from 'std/encoding/base64.ts';
import { Bson, Collection, MongoClient, Database as MongoDatabase } from 'mongo';
import { env } from './env.ts';

export class Database {
    #users: Collection<Profile>;
    #sessions: Collection<Session>;

    private constructor(db: MongoDatabase) {
        this.#users = db.collection<Profile>('users');
        this.#sessions = db.collection<Session>('sessions');
    }

    static async initialize(root: string) {
        // Initialize MongoDB connection
        const mongo = new MongoClient();
        const dbAddress = { host: env.MONGO_HOST, port: env.MONGO_PORT };
        const options: ConnectOptions = {
            compression: ['zlib', 'snappy', 'none'],
            db: root,
            servers: [dbAddress],
        };

        // Add credentials if necessary
        if (env.MONGO_USER && env.MONGO_PASS)
            options.credential = {
                username: env.MONGO_USER,
                password: env.MONGO_PASS,
            };

        const db = await mongo.connect(options);
        return new Database(db);
    }

    async createPendingSession(): Promise<PendingSession> {
        // Compute nonce
        const bytes = crypto.getRandomValues(new Uint8Array(64));
        const hash = await crypto.subtle.digest('SHA-512', bytes);
        const nonce = encode(hash);

        // Initialize session
        const expiresAt = new Date(Date.now() + 1000 * 60 * 5);
        const session: Omit<PendingSession, '_id'> = {
            nonce,
            expiresAt,
            verified: false,
        };

        // Insert to database
        const sessionId = await this.#sessions.insertOne(session);
        return { _id: sessionId as Bson.ObjectId, ...session };
    }

    upgradePendingSession(
        _id: Bson.ObjectId,
        nonce: string,
        info: Omit<ValidSession, '_id' | 'verified'>
    ) {
        return this.#sessions.findAndModify(
            { _id, nonce, verified: false },
            {
                new: true,
                upsert: true,
                fields: { _id: false },
                update: { $unset: { nonce: '' }, $set: { verified: true, ...info } },
            }
        ) as Promise<Omit<ValidSession, '_id'> | undefined>;
    }

    getSession(_id: Bson.ObjectId) {
        return this.#sessions.findOne({ _id }, { projection: { _id: false } }) as Promise<
            Omit<Session, '_id'>
        >;
    }

    insertUser(profile: Profile) {
        return this.#users.insertOne(profile);
    }
}
