import { Status } from 'oak';

import { env } from './env.ts';
import { FetchError, RateLimitError, TokenExchangeError } from './error.ts';

import { AccessTokenResponseSchema, RefreshTokenResponseSchema } from './model/oauth.ts';
import { ArtistAlbumsSchema, FollowedArtistsSchema, UserInfoSchema } from './model/spotify.ts';

// FIXME: At the moment, the client does not handle rate limiting.
export class SpotifyApiClient {
    #refreshToken: string;
    #expiresAt: number;
    #requestInit: RequestInit;

    /** Tokens cannot be expired. */
    constructor(accessToken: string, refreshToken: string, expiresAt: number) {
        this.#refreshToken = refreshToken;
        this.#expiresAt = expiresAt;
        this.#requestInit = {
            headers: new Headers({ Authorization: `Bearer ${accessToken}` }),
        };
    }

    get isExpired() {
        // TODO: Add some padding to allow refresh
        return Date.now() >= this.#expiresAt;
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

        if (response.status === Status.TooManyRequests) {
            const timeout = Number(response.headers.get('Retry-After') ?? 0);
            throw new RateLimitError(timeout);
        }

        const maybeToken = AccessTokenResponseSchema.parse(await response.json());
        if ('error' in maybeToken) throw new TokenExchangeError(maybeToken.error);

        // deno-lint-ignore camelcase
        const { access_token, refresh_token, expires_in } = maybeToken;
        const expiresAt = Date.now() + expires_in * 1e3;
        return new SpotifyApiClient(access_token, refresh_token, expiresAt);
    }

    async refresh() {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: this.#refreshToken,
                client_id: env.SPOTIFY_ID,
                client_secret: env.SPOTIFY_SECRET,
            }),
        });

        if (response.status === Status.TooManyRequests) {
            const timeout = Number(response.headers.get('Retry-After') ?? 0);
            throw new RateLimitError(timeout);
        }

        const maybeToken = RefreshTokenResponseSchema.parse(await response.json());
        if ('error' in maybeToken) throw new TokenExchangeError(maybeToken.error);

        // deno-lint-ignore camelcase
        const { access_token, expires_in } = maybeToken;
        const expiresAt = Date.now() + expires_in * 1e3;
        this.#expiresAt = expiresAt;
        this.#requestInit.headers = new Headers({ Authorization: `Bearer ${access_token}` });
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
            next = maybeAlbums.next;
            yield maybeAlbums.items;
        }
    }
}
