/// <reference lib="deno.worker" />

import { assert } from 'std/assert';
import { Bson } from 'mongo';
import { db } from 'db';

import { ArtistAlbums, FollowedArtists } from './model/spotify.ts';
import { Job, JobType, SessionToken } from './types/jobs.ts';

const sessionCache = new Map<string, SessionToken>();

async function processJob(job: Job) {
    // TODO: Handle case when access token expires
    const session = job.token ?? sessionCache.get(job.sessionId);
    assert(session, 'No session provided.');

    switch (job.query) {
        case JobType.GetFollowedArtists: {
            // Fetch user's followed artists
            const response = await fetch(job.url, {
                headers: { Authorization: `Bearer ${session.accessToken}` },
            });
            const maybeFollowedArtists = await response.json();
            const { next, items } = FollowedArtists.parse(maybeFollowedArtists);

            // FIXME: use bulk update for upserts
            // Cache the artists to the database
            const ids: string[] = [];
            const artists = items.map(artist => {
                setTimeout(processJob, 0, {
                    query: JobType.GetAlbums,
                    artistId: artist.id,
                    sessionId: job.sessionId,
                    userId: job.userId,
                });
                ids.push(artist.id);
                return {
                    _id: artist.id,
                    name: artist.name,
                    images: artist.images,
                    albums: [],
                };
            });

            // Cache the artists and update the user's profile
            const insertFuture = db.collection('artists').insertMany(artists, { ordered: false });
            const updateFuture = db
                .collection('users')
                .findAndModify(
                    { _id: Bson.ObjectId.createFromHexString(job.userId) },
                    { upsert: false, update: { $addToSet: { followedArtists: { $each: ids } } } }
                );
            await Promise.all([insertFuture, updateFuture]);

            // Create new followed artists job
            if (next)
                setTimeout(processJob, 0, {
                    url: next,
                    query: JobType.GetFollowedArtists,
                    sessionId: job.sessionId,
                    userId: job.userId,
                });

            break;
        }
        case JobType.GetAlbums: {
            const response = await fetch(
                `https://api.spotify.com/v1/artists/${job.artistId}/albums`
            );
            const maybeAlbums = await response.json();
            const { next, items } = ArtistAlbums.parse(maybeAlbums);

            const ids: string[] = [];
            const albums = items.map(album => {
                ids.push(album.id);

                const [year, month, day] = album.release_date.split('-').map(Number);
                const releaseDate: Bson.Document = {
                    precision: album.release_date_precision,
                };
                if (year !== undefined) releaseDate.year = year;
                if (month !== undefined) releaseDate.month = month;
                if (day !== undefined) releaseDate.day = day;

                return {
                    _id: album.id,
                    name: album.name,
                    images: album.images,
                    albumType: album.album_type,
                    releaseDate: releaseDate,
                };
            });

            // Cache the albums and update the artist's profile
            const insertFuture = db.collection('albums').insertMany(albums, { ordered: false });
            const updateFuture = db
                .collection('artists')
                .findAndModify(
                    { _id: Bson.ObjectId.createFromHexString(job.artistId) },
                    { upsert: false, update: { $addToSet: { albums: { $each: ids } } } }
                );
            await Promise.all([insertFuture, updateFuture]);

            // Create new job for next page
            if (next)
                setTimeout(processJob, 0, {
                    url: next,
                    query: JobType.GetAlbums,
                    sessionId: job.sessionId,
                    userId: job.userId,
                });

            break;
        }
    }
}

self.onmessage = evt => processJob(evt.data as Job);
