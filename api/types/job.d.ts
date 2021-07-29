export const enum JobType {
    GetFollowedArtists = 0,
    GetAlbums = 1,
}

export interface Job {
    query: JobType;
    sessionId: string;
    url: string;
}
