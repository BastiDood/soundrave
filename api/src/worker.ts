/// <reference lib="deno.worker" />

import { assert } from 'std/assert';
import { db } from 'db';

import { FollowedArtists } from './model/spotify.ts';
import { Job, JobType, SessionToken } from './types/jobs.ts';

const sessionCache = new Map<string, SessionToken>();

async function processJob({ url, query, sessionId, userId, token }: Job) {
    // TODO: Handle case when access token expires
    const session = token ?? sessionCache.get(sessionId);
    assert(session, 'No session provided.');

    switch (query) {
        case JobType.GetFollowedArtists: {
            // Fetch user's followed artists
            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${session.accessToken}` },
            });
            const maybeFollowedArtists = await response.json();
            const { next, items } = FollowedArtists.parse(maybeFollowedArtists);

            // FIXME: use bulk update for upserts
            // Cache the artists to the database
            const artists = items.map(artist => {
                setTimeout(processJob, 0, {
                    url: `https://api.spotify.com/v1/artists/${artist.id}/albums`,
                    query: JobType.GetAlbums,
                    sessionId,
                    userId,
                });
                return {
                    _id: artist.id,
                    name: artist.name,
                    images: artist.images,
                };
            });

            // Cache the artists and update the user profile
            await db.collection('artists').insertMany(artists, { ordered: false });

            // Create new followed artists job
            if (next)
                setTimeout(processJob, 0, {
                    url: next,
                    query: JobType.GetFollowedArtists,
                    sessionId,
                    userId,
                });

            break;
        }
        case JobType.GetAlbums: {
            break;
        }
    }
}

self.onmessage = function (event: MessageEvent<Job>) {
    return processJob(event.data);
};
