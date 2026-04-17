# API Reference

All endpoints are JSON. Auth is the `watcherr_auth` JWT cookie (set by `/api/auth/login`). All non-public endpoints require a valid, non-expired cookie whose `tokenVersion` matches the user row.

Error format (SvelteKit `error()` helper):
```json
{ "message": "string" }
```

Common status codes:
- `400` — validation error (missing field, regex fail)
- `401` — not authenticated
- `403` — authenticated but not admin / self-action forbidden
- `404` — user/resource not found
- `429` — login rate limit exceeded
- `500` — server error (DB, unexpected)

---

## Public auth

### `POST /api/auth/login`

Rate-limited: 5 attempts / 60 s per IP (XFF first hop).

Request:
```json
{ "username": "admin", "password": "changeme123" }
```

Responses:
- `200` — `{ "ok": true, "isAdmin": true }` + sets `watcherr_auth` cookie
- `400` — missing username/password
- `401` — `{ "message": "Invalid credentials" }`
- `429` — `{ "message": "Too many attempts" }`

Side effects: writes a `login_events` row (success or failure), updates `lastLoginAt` on success.

### `POST /api/auth/logout`

No body. Clears `watcherr_auth` cookie.

Response: `200 { "ok": true }`.

### `GET /api/auth/backdrops`

Returns up to 18 TMDB trending backdrop URLs for the login page.

Response: `200 { "backdrops": ["https://image.tmdb.org/t/p/original/...", ...] }`.
Falls back to `{ "backdrops": [] }` on TMDB failure (login page shows solid background).

---

## Authenticated user

### `POST /api/auth/change-password`

Requires auth cookie.

Request:
```json
{ "current": "old", "next": "new (>=8 chars)" }
```

Responses:
- `200` — `{ "ok": true, "jellyfinSynced": true | false | null }`
- `400` — `{ "message": "Password must be at least 8 characters" }`
- `401` — current password wrong, or no session

`jellyfinSynced`:
- `true` — linked Jellyfin user updated
- `false` — linked but sync failed (user should retry from `/admin`)
- `null` — no `jellyfinUserId`, nothing attempted

Side effect: bumps `tokenVersion` → all other sessions invalidated. The current cookie is re-signed in place so this session stays logged in.

---

## Admin — users

All `/api/admin/*` endpoints require `locals.user.isAdmin === true`. Otherwise `401` (no user) or `403` (user but not admin).

### `GET /api/admin/users`

Response: `200 { "users": [User, ...] }` — sorted by `createdAt` desc.

`User` shape:
```ts
{
  id: string;              // uuid
  username: string;
  isAdmin: boolean;
  lastLoginAt: string | null;   // ISO
  jellyfinUserId: string | null;
  createdAt: string;            // ISO
}
```
`passwordHash`, `tokenVersion`, and `preferences` are never returned.

### `POST /api/admin/users`

Request:
```json
{
  "username": "alice",       // regex ^[a-z0-9_.-]{3,32}$, lowercased
  "password": "at least 8",
  "isAdmin": false,
  "jellyfinUserId": "uuid or null"
}
```

Responses:
- `201` — `{ "user": User, "jellyfinSynced": true | false | null }`
- `400` — `{ "message": "Invalid username" | "Password too short" }`
- `409` — `{ "message": "Username already exists" }`

### `PATCH /api/admin/users/[id]`

Edit non-password fields.

Request (all optional):
```json
{
  "username": "new-name",
  "isAdmin": true,
  "jellyfinUserId": "uuid or null"
}
```

Responses:
- `200` — `{ "user": User }`
- `400` — validation
- `403` — self-demote (cannot remove own admin) **or** demoting the last remaining admin
- `404` — not found
- `409` — username collision

### `DELETE /api/admin/users/[id]`

Response: `200 { "ok": true }`.
- `403` — deleting self, or last admin
- `404` — not found

### `POST /api/admin/users/[id]/reset-password`

Request: `{ "password": "at least 8" }`
Response: `200 { "ok": true, "jellyfinSynced": true | false | null }`.

Bumps `tokenVersion` → target user signed out of all sessions. If linked, pushes the new password to Jellyfin.

### `POST /api/admin/users/[id]/force-logout`

No body. Response: `200 { "ok": true }`. Bumps `tokenVersion` only.

### `POST /api/admin/users/[id]/sync-jellyfin-password`

Manual retry. Used when a previous operation returned `jellyfinSynced: false`, the admin still has the plaintext in hand, and needs to retry.

Request: `{ "password": "plaintext" }`
Response: `200 { "ok": true, "jellyfinSynced": true | false }` (never `null` — caller is explicitly retrying).

---

## Admin — integrations

### `GET /api/admin/jellyfin-users`

Fetches all users from the configured Jellyfin server (via stored admin API key) for the "link to Jellyfin account" dropdown.

Response:
```json
{ "users": [ { "id": "uuid", "name": "string", "isAdmin": boolean } ] }
```

- `200` with empty array if Jellyfin is unreachable or not configured (UI shows a warning)
- `500` only on unexpected errors

### `GET /api/admin/login-events?limit=50`

Response:
```json
{
  "events": [
    {
      "id": "uuid",
      "username": "attempted name",
      "ip": "1.2.3.4",
      "success": true,
      "createdAt": "2026-04-15T10:00:00.000Z"
    }
  ]
}
```

`limit` is clamped to `[1, 200]`, default 50. Ordered by `createdAt` desc.

---

## Online Mode (v29+)

All endpoints require an authenticated user. Admin endpoints additionally require `user.isAdmin`.

### `PATCH /api/profile/mode`
Sets the caller's `user.mode`. Triggered by `FirstLoginModeModal` and `ProfileModeToggle`.

Request:
```json
{ "mode": "request" | "online" }
```
Response: `{ "ok": true, "mode": "online" }`  ·  `400` if mode not one of the two literals.

### `GET /api/admin/addons` — list installed addons
```json
{ "addons": [ { "id": "…", "name": "Torrentio", "manifestUrl": "…", "baseUrl": "…",
                "resources": ["stream"], "types": ["movie","series"], "enabled": true,
                "sortOrder": 0, "createdAt": "2026-04-16T…", "lastCheckedAt": "…" } ] }
```

### `POST /api/admin/addons` — install
Body: `{ "manifestUrl": "https://…/manifest.json" }`. Fetches and validates the manifest, stores the full URL (including any Real-Debrid key), assigns `sortOrder = count * 10`. Returns the new addon row. `409` on duplicate `manifestUrl`.

### `POST /api/admin/addons/validate`
Body: `{ "manifestUrl": "…" }`. Dry-run: fetches the manifest and returns `{ ok: true, manifest }` or `{ ok: false, error }`. Used by the install modal's "Validate" button.

### `PATCH /api/admin/addons/[id]`
Body: `{ "enabled"?: boolean, "sortOrder"?: number }`. Partial update.

### `DELETE /api/admin/addons/[id]`
Removes the addon. Returns `{ ok: true }`.

### `POST /api/admin/addons/[id]/refresh`
Re-fetches and validates the manifest, updates `manifest`, `resources`, `types`, `lastCheckedAt`.

### `GET /api/stream/movie/[tmdbId]`
Resolves TMDB id → IMDB id (cached), queries every enabled addon in parallel, returns normalized streams.
```json
{
  "streams": [
    { "id": "<sha1>", "url": "https://…", "quality": "1080p", "hdr": false,
      "title": "Dune.2021.1080p.BluRay.x264", "size": 12345678900, "seeders": 523, "source": "Torrentio" }
  ],
  "errors": [ { "addon": "example.com", "error": "timeout" } ]
}
```
Quality values: `'4k' | '1080p' | '720p' | '480p' | 'unknown'`.

### `GET /api/stream/series/[tmdbId]/[season]/[episode]`
Same shape. Stremio ID format `tt1234567:{season}:{episode}`.

### `GET /api/subtitles/movie/[tmdbId]`
### `GET /api/subtitles/series/[tmdbId]/[season]/[episode]`
```json
{
  "subtitles": [ { "lang": "en", "label": "English", "url": "https://<origin>/api/subtitles/proxy?token=<signed>" } ],
  "errors": []
}
```
Each URL is a proxied URL with a 60-min HMAC-signed token. Clients must not cache upstream URLs — they expire.

### `GET /api/subtitles/proxy?token=<signed>`
Verifies the HMAC token (`crypto.timingSafeEqual` + expiry check), fetches the upstream subtitle (8s timeout), returns with `content-type` preserved (`text/vtt` or `application/x-subrip`) and CORS headers. `400` for missing/malformed token, `401` for invalid/expired, `502` on upstream failure.

---

## Cookies

`watcherr_auth` — JWT payload:
```json
{ "sub": "<user uuid>", "v": 0, "iat": 1700000000, "exp": 1702592000, "iss": "watcherr" }
```

Attributes: `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`.

Sliding renewal: if `now - iat > 604800` (7 days) on any authenticated request, hook re-signs and re-sets the cookie with the same claims (new `iat`/`exp`).

Revocation: bump `user.tokenVersion`. Mismatched `v` claim → 303 to `/login`.
