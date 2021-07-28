import { ConnectOptions, MongoClient } from 'mongo';
import { Application } from 'oak';
import {
    MONGO_USER,
    MONGO_PASS,
    MONGO_HOST,
    MONGO_PORT,
    HOST,
    PORT,
} from 'env';

// Initialize MongoDB connection
const mongo = new MongoClient();
const dbAddress = { host: MONGO_HOST, port: MONGO_PORT };
const connOptions: ConnectOptions = {
    compression: ['zlib', 'snappy', 'none'],
    db: 'soundrave-api',
    servers: [dbAddress],
};

// Add credentials if necessary
if (MONGO_USER && MONGO_PASS)
    connOptions.credential = {
        username: MONGO_USER,
        password: MONGO_PASS,
    };

// Initialize Oak application
console.info('Initializing MongoDB client...');
const app = new Application({
    contextState: 'alias',
    state: await mongo.connect(connOptions),
});

// Set up middlewares
console.info('App listening...');
await app.listen({ hostname: HOST, port: PORT });
