import { ConnectOptions, MongoClient } from 'mongo';
import { Application } from 'oak';
import { env } from 'env';

import { auth } from './routes/auth.ts';

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

// Initialize Oak application
console.info('Initializing MongoDB client...');
const app = new Application({
    contextState: 'alias',
    state: await mongo.connect(connOptions),
});

// Set up middlewares
console.info('App listening...');
await app.use(auth.allowedMethods(), auth.routes()).listen({ hostname: env.HOST, port: env.PORT });
