/// <reference lib="deno.worker" />

import { assert } from 'std/assert';
import { Bson } from 'mongo';
import { db } from 'db';

import { FollowedArtists } from './model/spotify.ts';
import { Job, JobType, SessionToken } from './types/jobs.ts';

const sessionCache = new Map<string, SessionToken>();

async function processJob({ url, query, sessionId, userId, token }: Job) {
    // TODO: Handle case when access token expires
    const session = token ?? sessionCache.get(sessionId);
    assert(session, 'No session provided.');

    // Fetch user's followed artists
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    const maybeResponse = await response.json();

    switch (query) {
        case JobType.GetFollowedArtists: {
            const { next, items } = FollowedArtists.parse(maybeResponse);

            // FIXME: use bulk update for upserts
            // Cache the artists to the database
            const ids: string[] = [];
            const artists = items.map(artist => {
                setTimeout(processJob, 0, {
                    url: `https://api.spotify.com/v1/artists/${artist.id}/albums`,
                    query: JobType.GetAlbums,
                    sessionId,
                    userId,
                });
                ids.push(artist.id);
                return {
                    _id: artist.id,
                    name: artist.name,
                    images: artist.images,
                };
            });

            // Cache the artists and update the user's profile
            const insertFuture = db.collection('artists').insertMany(artists, { ordered: false });
            const updateFuture = db.collection('users').findAndModify(
                {
                    _id: Bson.ObjectId.createFromHexString(userId),
                },
                { upsert: false, update: { $addToSet: { followedArtists: { $each: ids } } } }
            );

            // Create new followed artists job
            if (next)
                setTimeout(processJob, 0, {
                    url: next,
                    query: JobType.GetFollowedArtists,
                    sessionId,
                    userId,
                });

            await Promise.all([insertFuture, updateFuture]);
            break;
        }
        case JobType.GetAlbums: {
            break;
        }
    }
}

self.onmessage = evt => processJob(evt.data as Job);
