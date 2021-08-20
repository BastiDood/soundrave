import { Status } from 'oak';

import { env } from './env.ts';
import { FetchError, RateLimitError, TokenExchangeError } from './error.ts';

import { AuthenticationResponseSchema } from './model/oauth.ts';
import { ArtistAlbumsSchema, FollowedArtistsSchema, UserInfoSchema } from './model/spotify.ts';

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

        const maybeToken = AuthenticationResponseSchema.parse(await response.json());
        if ('error' in maybeToken) throw new TokenExchangeError(maybeToken.error);

        return {
            token: maybeToken,
            client: new SpotifyApiClient(maybeToken.access_token),
        };
    }

    async fetchUserProfile() {
        const response = await fetch('https://api.spotify.com/v1/me', this.#requestInit);
        if (response.status === Status.TooManyRequests) {
            const timeout = Number(response.headers.get('Retry-After') ?? 0);
            throw new RateLimitError(timeout);
        }

        const maybeUserInfo = UserInfoSchema.parse(await response.json());
        if ('message' in maybeUserInfo) throw new FetchError(maybeUserInfo.message);
        return maybeUserInfo;
    }

    async *fetchFollowedArtists() {
        let next: string | null = 'https://api.spotify.com/v1/me/following?type=artist&limit=50';
        while (next) {
            const response = await fetch(next, this.#requestInit);
            if (response.status === Status.TooManyRequests) {
                const timeout = Number(response.headers.get('Retry-After') ?? 0);
                throw new RateLimitError(timeout);
            }

            const maybeArtists = FollowedArtistsSchema.parse(await response.json());
            if ('message' in maybeArtists) throw new FetchError(maybeArtists.message);
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
            if (response.status === Status.TooManyRequests) {
                const timeout = Number(response.headers.get('Retry-After') ?? 0);
                throw new RateLimitError(timeout);
            }

            const maybeAlbums = ArtistAlbumsSchema.parse(await response.json());
            if ('message' in maybeAlbums) throw new FetchError(maybeAlbums.message);
            yield maybeAlbums.items;
            next = maybeAlbums.next;
        }
    }
}
