export interface SessionToken {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
}

export const enum JobType {
    GetFollowedArtists,
    GetAlbums,
}

export interface GetFollowedArtists {
    query: JobType.GetFollowedArtists;
    sessionId: string;
    userId: string;
    token?: SessionToken;
    url: string;
}

export interface GetAlbums {
    query: JobType.GetAlbums;
    url: string;
    sessionId: string;
    token?: SessionToken;
}

export type Job = GetFollowedArtists | GetAlbums;
