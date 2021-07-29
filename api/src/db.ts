import { env } from 'env';
import { ConnectOptions, MongoClient } from 'mongo';

// Initialize MongoDB connection
const mongo = new MongoClient();
const dbAddress = { host: env.MONGO_HOST, port: env.MONGO_PORT };
const connOptions: ConnectOptions = {
    compression: ['zlib', 'snappy', 'none'],
    db: 'soundrave-api',
    servers: [dbAddress],
};

// Add credentials if necessary
if (env.MONGO_USER && env.MONGO_PASS)
    connOptions.credential = {
        username: env.MONGO_USER,
        password: env.MONGO_PASS,
    };

export const db = await mongo.connect(connOptions);
