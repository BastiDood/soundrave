This is an app that plops down recent releases from your followed artists.

# Environment Variables
```
# Server Configuration
NODE_ENV=development
PORT=3000
DEFAULT_COUNTRY=<ISO_3166-1_alpha-2_Country_Code>

# MongoDB Configuration
MONGO_DB_CACHE_URL=<Mongo_DB_for_Local_Cache>
MONGO_DB_SESSION_URL=<Mongo_DB_for_Session_Storage>
MONGO_DB_SESSION_SECRET=<Mongo_DB_Secret>

# Cryptography Secrets
COOKIE_SECRET=<must_have_at_least_32_characters>

# Spotify API Secrets
CLIENT_ID=<Spotify_ID>
CLIENT_SECRET=<Spotify_Secret>
```

# Spotify Dummy Data for Followed Artists
```typescript
type SpotifyURLObject = { [key: string]: string };
type SpotifyImageObject = {
  height: number,
  url: string,
  width: number
};
type SpotifyArtistObject = {
  external_urls: SpotifyURLObject,
    followers: {
      href: null,
      total: number
    },
    genres: string[],
    href: string,
    id: string,
    images: SpotifyImageObject[],
    name: string,
    popularity: number,
    type: 'artist',
    uri: string
};
interface SpotifyResponse = {
  artists: {
    items: SpotifyArtistObject[],
    next: string,
    total: number,
    cursors: { after: string },
    limit: number,
    href: string
  }
};
```
