import { db } from 'db';
import { env } from 'env';
import { Bson } from 'mongo';
import { Router, RouterContext, RouteParams, Status } from 'oak';
import { z } from 'zod';
import { encode } from 'std/encoding/base64';

import { SpotifyApiClient } from '../spotify.ts';
import { AuthorizationResponse, OAUTH_SCOPE } from '../model/oauth.ts';
import { Profile } from '../model/profile.ts';
import { RawPendingSession, RawValidSession } from '../model/session.ts';

export const auth = new Router({ prefix: '/auth' })
    .get('/login', async (ctx: RouterContext<RouteParams, Record<string, unknown>>) => {
        // TODO: Allow users with partially verified sessions.
        ctx.assert(
            ctx.cookies.get('sid', { signed: true }) === undefined,
            Status.Forbidden,
            'session IDs not allowed'
        );

        // The SHA-512 algorithm has a block size of 128 bytes,
        // hence the length of the randomized bytes.
        const bytes = crypto.getRandomValues(new Uint8Array(128));

        // Generate hashed nonce from random bytes
        const hashed = await crypto.subtle.digest('SHA-512', bytes);
        const nonce = encode(hashed);

        // Create new session
        const session: z.infer<typeof RawPendingSession> = {
            verified: false,
            timeToLive: 3600,
            nonce,
        };

        // Send session to database
        const { insertedId } = await db.collection('collection').insertOne(session);
        ctx.assert(
            insertedId instanceof Bson.ObjectId,
            Status.InternalServerError,
            'invalid object ID'
        );

        // Send session ID to user
        ctx.cookies.set('sid', insertedId.toHexString(), {
            signed: true,
            httpOnly: true,
            sameSite: 'lax',
            overwrite: true,
            secure: true,
            maxAge: 3300,
        });

        // Redirect to Spotify authorization
        const params = new URLSearchParams({
            client_id: env.SPOTIFY_ID,
            reponse_type: 'code',
            redirect_uri: env.OAUTH_REDIRECT,
            state: nonce,
            scope: OAUTH_SCOPE,
        });
        ctx.response.redirect('https://accounts.spotify.com/authorize?' + params.toString());
    })
    .get('/callback', async (ctx: RouterContext<RouteParams, Record<string, unknown>>) => {
        // Disallow users without ID
        const sessionId = ctx.cookies.get('sid', { signed: true });
        ctx.assert(sessionId, Status.Forbidden, 'no session ID provided');

        // Retrieve session nonce
        const sessionQuery = {
            _id: Bson.ObjectId.createFromHexString(sessionId),
            verified: false,
        };
        const maybeNonce = await db.collection('sessions').findOne(
            {
                _id: Bson.ObjectId.createFromHexString(sessionId),
                verified: false,
            },
            { findOne: true, projection: { _id: false, nonce: true } }
        );

        // Validate session nonce
        const { nonce } = z.object({ nonce: z.string().nonempty() }).parse(maybeNonce);

        // TODO: invalidate session
        // Verify nonce
        const authResponse = AuthorizationResponse.parse(ctx.params);
        ctx.assert(
            nonce === authResponse.state,
            Status.InternalServerError,
            'cannot validate nonce'
        );

        // Verify permission success
        if ('error' in authResponse) ctx.throw(Status.InternalServerError, authResponse.error);

        // Exchange authorization code for access token
        const { token, client } = await SpotifyApiClient.initialize(authResponse.code);
        const profileResult = await client.fetchUserProfile();
        if (!profileResult.ok) {
            const { error } = profileResult;
            const message =
                typeof error === 'number' ? `retry after ${error} seconds` : error.message;
            ctx.throw(Status.InternalServerError, message);
        }

        // Create new user
        const profile = profileResult.data;
        const user: z.infer<typeof Profile> = {
            _id: profile.id,
            country: profile.country,
            displayName: profile.display_name,
            images: profile.images,
            followedArtists: [],
        };

        // Submit new user
        await db.collection('users').insertOne(user);

        // Construct new session
        const newSession: z.infer<typeof RawValidSession> = {
            // Expire the session two weeks after access token expires
            timeToLive: token.expires_in + 1209600,
            verified: true,
            userId: user._id,
            accessToken: token.access_token,
            refreshToken: token.refresh_token,
            expiresAt: Date.now() + token.expires_in * 1000,
        };

        // Submit new session to MongoDB
        await db
            .collection('sessions')
            .updateOne(
                sessionQuery,
                { $unset: { nonce: '' }, $set: newSession },
                { upsert: false, multi: false }
            );

        ctx.response.redirect('/timeline');
    });
