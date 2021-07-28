# Soundrave API
This workspace hosts the code for the main back-end API for Soundrave.

# Environment Variables
**Variable**     | **Description**                                                                                       | **Required** | **Default**
---------------- | ----------------------------------------------------------------------------------------------------- | :----------: | ----------:
`SPOTIFY_ID`     | Client ID provided by the [Spotify Developer Console](https://developer.spotify.com/dashboard/).      | &#x2714;     |
`SPOTIFY_SECRET` | Client secret provided by the [Spotify Developer Console](https://developer.spotify.com/dashboard/).  | &#x2714;     |
`OAUTH_REDIRECT` | Redirect URI configured at the [Spotify Developer Console](https://developer.spotify.com/dashboard/). | &#x2714;     |
`MONGO_USER`     | Configured username at the MongoDB instance.                                                          | &#x274c;     |
`MONGO_PASS`     | Configured password at the MongoDB instance.                                                          | &#x274c;     |
`MONGO_HOST`     | Hostname to connect to when accessing the database.                                                   | &#x274c;     | `localhost`
`MONGO_PORT`     | Port to connect to when accessing the database.                                                       | &#x274c;     | `27017`
`HOST`           | Network interface/s to which the server will bind and listen.                                         | &#x274c;     | `localhost`
`PORT`           | Port to which the server will bind and listen.                                                        | &#x274c;     | `8080`
