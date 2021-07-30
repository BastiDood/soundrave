import { Status } from 'oak';
import { env } from 'env';
import type { z } from 'zod';

import { ApiError, ArtistAlbums, FollowedArtists, User, UserInfo } from './model/spotify.ts';
import { AuthenticationResponse } from './model/oauth.ts';
import { Result } from './types/result.d.ts';

type UserType = z.infer<typeof User>;
type ApiErrorType = z.infer<typeof ApiError>;

// FIXME: At the moment, the client does not handle rate limiting.
export class SpotifyApiClient {
    #requestInit: RequestInit;

    /** Tokens cannot be expired. */
    constructor(accessToken: string) {
        this.#requestInit = {
            headers: new Headers({ Authorization: `Bearer ${accessToken}` }),
        };
    }

    static async initialize(code: string) {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            body: new URLSearchParams({
                code,
                grant_type: 'authorization_code',
                client_id: env.SPOTIFY_ID,
                client_secret: env.SPOTIFY_SECRET,
                redirect_uri: env.OAUTH_REDIRECT,
            }),
        });

        const maybeToken = AuthenticationResponse.parse(await response.json());
        if ('error' in maybeToken) throw new Error(maybeToken.error);

        return {
            token: maybeToken,
            client: new SpotifyApiClient(maybeToken.access_token),
        };
    }

    async fetchUserProfile(): Promise<Result<UserType, ApiErrorType | number>> {
        const response = await fetch('https://api.spotify.com/v1/me', this.#requestInit);
        if (response.status === Status.TooManyRequests) {
            const timeout = Number(response.headers.get('Retry-After') ?? 0);
            return { ok: false, error: timeout };
        }

        const maybeUserInfo = UserInfo.parse(await response.json());
        if ('type' in maybeUserInfo) return { ok: true, data: maybeUserInfo };
        return { ok: false, error: maybeUserInfo };
    }

    async *fetchFollowedArtists() {
        let next: string | null = 'https://api.spotify.com/v1/me/following?type=artist&limit=50';
        while (next) {
            const response = await fetch(next, this.#requestInit);
            const maybeArtists = FollowedArtists.parse(await response.json());
            if ('message' in maybeArtists) throw new Error(maybeArtists.message);
            yield maybeArtists.items;
            next = maybeArtists.next;
        }
    }

    async *fetchAlbums(id: string, country: string) {
        let next:
            | string
            | null = `https://api.spotify.com/v1/artists/${id}/albums?limit=50&include_groups=album,single&market=${country}`;
        while (next) {
            const response = await fetch(next, this.#requestInit);
            const maybeAlbums = ArtistAlbums.parse(await response.json());
            if ('message' in maybeAlbums) throw new Error(maybeAlbums.message);
            yield maybeAlbums.items;
            next = maybeAlbums.next;
        }
    }
}
