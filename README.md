# NexiPals

Small transient chat application for Nexigen developers. Developers appear as
little creatures in the React frontend and communicate through a Bun WebSocket
server.

## Development

Install dependencies and create a local secret:

```sh
bun install
export NEXIPALS_COOKIE_SECRET="replace-this-with-at-least-32-random-characters"
export NEXIPALS_ALLOWED_ORIGINS="http://localhost:5173"
bun run dev
```

The server defaults to `127.0.0.1:3001` and exposes:

- `GET /api/session` to create or validate the signed browser identity cookie.
- `GET /healthz` for a private health check.
- `GET /ws` for the authenticated WebSocket upgrade.

The WebSocket client must call `/api/session` first, retain the secure cookie,
and then connect to `/ws` with the same origin. The server sends presence
events and broadcasts transient `chat.message` events. It does not retain or
replay message content. The frontend should replace the visible message for a
sender and hide it after 15 seconds.

## Configuration

- `NEXIPALS_COOKIE_SECRET`: required, at least 32 characters.
- `NEXIPALS_ALLOWED_ORIGINS`: comma-separated exact origins; wildcards are not allowed.
- `NEXIPALS_HOST`: defaults to `127.0.0.1`.
- `NEXIPALS_PORT`: defaults to `3001`.
- `NEXIPALS_MAX_MESSAGE_LENGTH`: defaults to `280` Unicode grapheme clusters.

For production, place the service behind the office reverse proxy. Bun should
remain bound to a private interface, while the proxy terminates the
office-trusted TLS certificate, permits only VPN CIDRs, and forwards WebSocket
upgrade headers.

## Verification

```sh
bun test
bun run typecheck
```
