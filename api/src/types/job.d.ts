export interface SessionToken {
    _id: string;
    accessToken: string;
    refreshToken: string;
}

export const enum JobType {
    GetFollowedArtists = 0,
    GetAlbums = 1,
}

export interface Job {
    query: JobType;
    session: SessionToken;
    url: string;
}
