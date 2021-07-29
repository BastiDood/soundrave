export interface SessionToken {
    accessToken: string;
    refreshToken: string;
}

export const enum JobType {
    GetFollowedArtists,
    GetAlbums,
}

export interface Job {
    query: JobType;
    sessionId: string;
    userId: string;
    token?: SessionToken;
    url: string;
}
