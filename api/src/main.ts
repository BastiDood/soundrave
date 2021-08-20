import { Application } from 'oak';
import { env } from './env.ts';
import { auth } from './routes/mod.ts';

// Set up middlewares
console.info('App listening...');
await new Application()
    .use(auth.allowedMethods(), auth.routes())
    .listen({ hostname: env.HOST, port: env.PORT });
