# API Documentation

The IPTV Manager provides a RESTful API.

If running in development mode (`NODE_ENV=development`), full Swagger OpenAPI documentation is available at:
`http://localhost:3001/api/docs`

## Authentication

The API uses JWT access tokens.
1. Authenticate via `POST /api/auth/login`. If TOTP is enabled, include the `totpCode`.
2. The response will contain an `accessToken`.
3. Pass this token in the `Authorization` header for subsequent requests:
   `Authorization: Bearer <your_access_token>`
4. A secure `refreshToken` HTTP-Only cookie is automatically set to allow silent token refreshes via `POST /api/auth/refresh`.

## Key Endpoints

### Playlists
- `GET /api/playlists` - List playlists
- `POST /api/playlists` - Create a new remote playlist source
- `POST /api/playlists/:id/sync` - Force immediate fetch and parse of remote M3U

### Channels
- `GET /api/channels` - List parsed channels (supports search, filter by group/health)
- `PATCH /api/channels/:id/toggle` - Enable/Disable a specific channel

### Generated Outputs
- `POST /api/output` - Create a new generated M3U output from multiple sources
- `GET /p/:token` - **PUBLIC** endpoint to fetch the generated M3U playlist file. Does not require authentication.
