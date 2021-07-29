export interface SessionToken {
    accessToken: string;
    refreshToken: string;
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
    artistId: string;
    sessionId: string;
    userId: string;
    token?: SessionToken;
}

export type Job = GetFollowedArtists | GetAlbums;
