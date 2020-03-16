This is an app that plops down recent releases from your followed artists.

# Environment Variables
```
# Server Configuration
NODE_ENV=development
PORT=3000

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
