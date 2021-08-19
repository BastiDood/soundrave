import { assert } from 'std/testing/asserts.ts';

const HOST = Deno.env.get('HOST') ?? 'localhost';
const PORT = Number(Deno.env.get('PORT') ?? 8080);
const OAUTH_REDIRECT = Deno.env.get('OAUTH_REDIRECT') ?? `http://${HOST}:${PORT}/auth/callback`;

const SPOTIFY_ID = Deno.env.get('SPOTIFY_ID');
assert(SPOTIFY_ID, 'no Spotify client ID provided');
const SPOTIFY_SECRET = Deno.env.get('SPOTIFY_SECRET');
assert(SPOTIFY_SECRET, 'no Spotify client secret provided');

const MONGO_HOST = Deno.env.get('MONGO_HOST') ?? 'localhost';
const MONGO_PORT = Number(Deno.env.get('MONGO_PORT') ?? 27017);
const MONGO_USER = Deno.env.get('MONGO_USER');
const MONGO_PASS = Deno.env.get('MONGO_PASS');

export const env = {
    MONGO_USER,
    MONGO_PASS,
    MONGO_HOST,
    MONGO_PORT,
    SPOTIFY_ID,
    SPOTIFY_SECRET,
    HOST,
    PORT,
    OAUTH_REDIRECT,
};
