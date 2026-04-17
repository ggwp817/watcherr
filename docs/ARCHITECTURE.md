# Architecture

## Overview

WATCHERR is a SvelteKit (Svelte 3) app providing a media-management UI with an authentication layer, an admin user-management surface, and a Jellyfin password-sync mechanism. It runs as a Node.js server (via `@sveltejs/adapter-node`) and persists state in SQLite via TypeORM with `synchronize: true` (no migration files).

```
                                 ┌────────────────────────┐
              ┌──── /login ─────►│ login page             │
              │                  │ (rotating TMDB         │
              │                  │  backdrops + form)     │
              │                  └────┬───────────────────┘
              │                       │ POST /api/auth/login
              │                       ▼
 browser ─────┤      ┌────────────────────────────────┐
              │      │ hooks.server.ts (auth gate)    │
              │      │  - reads watcherr_auth cookie  │
              │      │  - verifies JWT (HS256)        │
              │      │  - loads User, checks tokenVer │
              │      │  - sets locals.user            │
              │      │  - public allowlist or 303     │
              │      └─────┬──────────────────────────┘
              │            │ event passes through
              │            ▼
              ├──► routes (admin / app pages / API)
              │        - +layout.server.ts (admin gate)
              │        - +page.server.ts (settings gate)
              │        - +server.ts (API endpoints)
              │
              └──► /api/admin/* ──► requireAdmin() ──► User/LoginEvent ORM
                                                    └──► Jellyfin admin API
                                                         (X-Emby-Token)
```

## Authentication model

### Why JWT cookies (not server-side sessions)
- **Stateless**: no session table to vacuum, no per-request DB lookup just for "is this token valid".
- **Revocable**: each `User` row has a `tokenVersion: integer`. JWT carries `v` claim. On every request the hook fetches the user and compares `user.tokenVersion === claims.v`. Bumping `tokenVersion` (force logout, password change) instantly invalidates every previously-issued token for that user.

### Cookie
- Name: `watcherr_auth`
- `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, `Max-Age=2592000` (30 days)
- Set by `POST /api/auth/login`, cleared by `POST /api/auth/logout`

### Sliding renewal
If a request arrives with a JWT older than 7 days (`Date.now()/1000 - claims.iat > 604800`), the hook re-signs and re-sets the cookie. Active users never see a forced logout; idle accounts age out at 30 days.

### Session secret
`getSessionSecret()` precedence (cached after first call):
1. `process.env.SESSION_SECRET`
2. Row in `app_config` table with key `session_secret`
3. Generated `crypto.randomBytes(32).toString('hex')` and persisted

This means a fresh deploy boots without configuration and survives container restarts.

### Rate limit
`checkLoginRateLimit(ip)` — in-memory `Map<string, number[]>` of timestamps. Window: 60s. Max: 5 attempts. Per-IP. Reset across process restarts (acceptable; production sits behind Cloudflare and Caddy which handle DoS upstream). XFF first hop is preferred over `getClientAddress()`.

### Password storage
`bcryptjs` (pure JS, avoids native-module headaches in Alpine images). Cost 12. Verification returns `false` on malformed hashes — never throws — so an empty/missing `passwordHash` row can't 500 the login endpoint.

## Data model

```
users (synchronized by TypeORM on boot)
├── id            uuid, PK
├── username      text, UNIQUE INDEX, lowercased on write
├── passwordHash  text (bcrypt)
├── isAdmin       boolean default false
├── tokenVersion  integer default 0      ← bump to revoke
├── lastLoginAt   datetime nullable
├── jellyfinUserId   text nullable       ← link target for password sync
├── jellyfinAuthToken text nullable      ← reserved (unused)
└── preferences   simple-json nullable

login_events
├── id          uuid, PK
├── username    text (the attempted name, even if unknown)
├── ip          text
├── success     boolean
└── createdAt   datetime, default now()

app_config
├── key   text, PK
└── value text                           ← currently only "session_secret"
```

`Settings` table stores integration config. Sonarr / Radarr / Jellyfin connection details still live there.

## Request lifecycle

### Page request (browser → SvelteKit)
1. `hooks.server.ts` runs first.
2. Reads `watcherr_auth` cookie.
3. If valid JWT and matching `tokenVersion`: sets `locals.user = { id, username, isAdmin, tokenVersion }`. Renews cookie if >7d old.
4. If path is in `PUBLIC_PATHS` (`/login`), `PUBLIC_PREFIXES` (`/api/auth/{login,logout,backdrops}`), or `STATIC_PREFIXES` (`/_app/`, `/@fs/`, `/src/`, `/node_modules/`, `/favicon`, `/icons/`, `/apple-touch-icon`, `/manifest.webmanifest`, `/logo_`): pass through.
5. Otherwise: if `locals.user` is null, throw `redirect(303, '/login')`.

### Admin request
After the hook, `/admin/+layout.server.ts` runs:
- No user → `redirect(303, '/login')` (defensive; the hook should already have done this)
- User but `!isAdmin` → `redirect(303, '/')`

### Admin API request
`requireAdmin(event)` is called at the top of every `/api/admin/*` handler:
- No user → `error(401, 'Unauthorized')`
- User but `!isAdmin` → `error(403, 'Forbidden')`

### SSR note
WATCHERR has `export const ssr = false` in `src/routes/+layout.ts`. Server-side `redirect` thrown from `+layout.server.ts` or `+page.server.ts` is therefore enforced in the data layer (client navigation), not in the initial HTML. The hook-level redirect (`hooks.server.ts`) still enforces auth on the initial document request, so unauthenticated users always hit `/login` first.

## Jellyfin password sync

When admin does any of these on a user whose `jellyfinUserId` is set:
- Create user (`POST /api/admin/users`)
- Reset password (`POST /api/admin/users/[id]/reset-password`)
- User changes own password (`POST /api/auth/change-password`)
- Manual retry (`POST /api/admin/users/[id]/sync-jellyfin-password`)

WATCHERR calls `setJellyfinPassword()` which POSTs to Jellyfin's
`/Users/{id}/Password` with header `X-Emby-Token: <admin api key>` and body
`{ "NewPw": "<plaintext>", "ResetPassword": false }`.

The wrapper (`syncJellyfinPassword`) catches all errors and returns a boolean. The calling endpoint surfaces the result as `jellyfinSynced: true | false | null` (`null` means "no link configured, didn't try"). UI shows a toast/alert when sync fails so the admin can retry.

**Why plaintext at sync time:** Jellyfin's admin password-set endpoint requires plaintext. We never store plaintext — we only hold it in memory for the duration of the request that originally received it (login form submission, admin reset modal, etc.). Linking a user to Jellyfin without supplying a password (PATCH with `jellyfinUserId` change) does NOT push anything to Jellyfin; the admin must follow up with a reset-password call.

## File structure decisions

### Why one file per API route segment
SvelteKit's file-based routing. Splitting `/api/admin/users/[id]/{reset-password,force-logout,...}` into separate `+server.ts` files keeps each handler small (10-30 lines) and each test scope isolated.

### Why entities live in `lib/entities/`
Convention. All entities follow it.

### Why `lib/server/auth/` (not `lib/auth/`)
SvelteKit treats `$lib/server/*` as server-only — anything imported there can never be bundled into the client. Critical for `bcryptjs`, `jsonwebtoken`, the session secret, and the Jellyfin admin API key.

### Why we created a `requireAdmin` helper instead of duplicating checks
8 admin endpoints share the same 401/403 guard. The helper centralizes the messages and uses SvelteKit's `error()` helper so the response body and status are consistent.

## Online Mode (v29+)

Parallel playback path for users who want instant streaming instead of the request-and-wait flow.

### Data model

Three schema additions, all auto-migrated by `synchronize: true`:

- **`users.mode`** — `text nullable`. `null` triggers the first-login card picker. `'request'` is the classic flow, `'online'` enables Stremio-addon streaming.
- **`addons`** — admin-installed Stremio manifests. `id (uuid)`, `name`, `manifestUrl (unique)`, `baseUrl`, `manifest (json)`, `resources (array)`, `types (array)`, `enabled`, `sortOrder`, `createdAt`, `lastCheckedAt`. Indexed on `(enabled, sortOrder)`.
- **`tmdb_imdb_map`** — two-column PK `(tmdbId, type)` with nullable `imdbId` (negative-cache misses so we don't hit TMDB repeatedly for titles with no IMDB id).

### Request flow

1. User (mode=online) opens a movie/episode page → sees **Stream** button instead of **Request**.
2. Click → `GET /api/stream/movie/{tmdbId}` (or `/series/{tmdbId}/{season}/{episode}`).
3. Server resolves IMDB id via `tmdbImdb.ts` (DB cache → TMDB `/external_ids`), then `streamAggregator.ts` queries every enabled addon in parallel (`Promise.allSettled`, 8s timeout each), normalizes results via `streamNormalizer.ts`, dedupes by SHA1(url), sorts by quality > size > seeders, caches 5 min in an in-memory LRU.
4. Response returns `{ streams: [...], errors: [...] }`. Addon failures become soft errors surfaced in the UI, not a hard 500.
5. User picks a row → `StreamListModal` calls `playerState.streamExternal({ url, title, subtitles })` → existing `VideoPlayer` mounts with `<video src={externalUrl}>` and `<track>` elements for each subtitle.

### Security boundaries

- **Real-Debrid keys never reach the client.** Admins paste manifest URLs like `https://torrentio.strem.fun/realdebrid=KEY/manifest.json`. The full URL — including the key — is stored server-side on the `Addon` row. Only the resolved stream URLs (already RD-debrided into direct HTTPS) cross the client boundary.
- **Subtitle proxy is HMAC-signed.** `subtitleAggregator.ts` wraps every subtitle URL in `/api/subtitles/proxy?token=…`, where `token` is `base64url(JSON{url,exp}).base64url(HMAC-SHA256(sessionSecret, payload))`. `subtitles/proxy/+server.ts` verifies the MAC with `crypto.timingSafeEqual`, enforces the expiry, then proxies upstream. Prevents an attacker from turning our server into an open proxy for arbitrary URLs.
- **Admin-only addon CRUD.** `/api/admin/addons*` paths all call `requireAdmin()`.

### Caching strategy

- Stream aggregation: 5 min per `(stremioId, type)` in an LRU (500 entries, oldest evicted).
- Subtitle aggregation: 10 min per key.
- TMDB→IMDB: persistent — DB-backed, no TTL (IMDB ids don't change; misses are also cached to avoid retry spam).
- Subtitle proxy token TTL: 60 min (enough for one play session).

### Player integration

`VideoPlayer.ts` exports a new `streamExternal({ url, title, subtitles })` method on `playerState`. It mirrors `streamJellyfinId` but:

- Sets `externalUrl` instead of `jellyfinId`.
- Maps Stremio subtitle langs to the player's `SubtitleLanguage` (`'en' | 'ar'`); anything else is dropped.
- `VideoPlayer.svelte` `onMount` checks `externalUrl` first — if set, `video.src = externalUrl` directly and the Jellyfin/HLS/Bazarr branches are skipped. Existing `<track>` rendering and `SubtitleOverlay` work unchanged because `subtitleTracks` is populated from the external list.

## Trade-offs

- **`synchronize: true`** auto-creates and migrates schema based on entity definitions. Easy for a single-instance deploy; risky for multi-node or destructive column renames. Acceptable here because all data is recoverable (Jellyfin is the source of truth for media; users are short).
- **No CSRF token**. Cookie is `SameSite=Lax`, all mutating endpoints are POST/PATCH/DELETE on same-origin paths, browsers won't auto-attach the cookie to cross-site form posts. If WATCHERR ever adds embedded third-party iframes that mutate state, add a CSRF token.
- **In-memory rate limit** is per-process. With a single container deployment that's fine. If horizontally scaled, move the bucket to Redis.
- **Hardcoded TMDB key in `lib/constants.ts`** — override with `TMDB_API_KEY` env var if rotating.
- **PNG icons are programmatically generated** (pure-Node PNG encoder, since the build host had neither ImageMagick nor `librsvg`). They render a stylized "W" on the brand background. Replace `static/icons/icon-*.png` and `static/apple-touch-icon.png` with hand-crafted artwork before public release.
