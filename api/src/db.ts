import type { Profile } from './model/profile.ts';
import type { Session } from './model/session.ts';
import type { ConnectOptions } from 'mongo';

import { env } from './env.ts';
import { Collection, MongoClient, Database as MongoDatabase } from 'mongo';

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
}
