import { Application } from 'oak';
import { Database } from './db.ts';
import { env } from './env.ts';
import { auth } from './routes/mod.ts';

// Set up middlewares
console.info('App listening...');
await new Application({ contextState: 'alias', state: await Database.initialize('soundrave-api') })
    .use(auth.allowedMethods(), auth.routes())
    .listen({ hostname: env.HOST, port: env.PORT });
