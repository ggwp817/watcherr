# WATCHERR

Self-hosted media library frontend for Jellyfin + Sonarr + Radarr, with login-gated access, admin user management, and unified Jellyfin password sync.

WATCHERR is a self-hosted media request and management UI for Jellyfin, Sonarr, and Radarr, with built-in authentication and admin user management:

- **Login required for everything.** No anonymous access. Sessions are JWT cookies (30-day sliding renewal) verified in `hooks.server.ts`.
- **Admin panel** at `/admin` for user CRUD, integration status, and login activity. Only admins can configure Jellyfin/Sonarr/Radarr.
- **Unified password.** When an admin creates or resets a user's password and links them to a Jellyfin account, WATCHERR pushes the same password to Jellyfin via the admin API. One credential pair works for both apps.
- **Default admin** seeded on first boot: `admin` / `changeme123` (change immediately).
- **PWA** — installable on iOS Safari and Android Chrome with proper icons, splash, and theme.
- **Login page** styled after Jellyseerr: rotating TMDB trending backdrops + glass card.
- **Fully rebranded** as WATCHERR throughout.
- **Dual-mode browsing (v29+).** Each user picks **Request Mode** (classic: Radarr/Sonarr → Jellyfin) or **Online Mode** (Stremio-addon streaming via Real-Debrid). First login shows a card picker; change anytime from `/profile`. Admins install addons at `/admin/addons`.

## Quick start

```bash
docker compose -f watcherr/docker-compose.yml up -d
# visit http://<host>:9494 → log in as admin / changeme123
# change the password immediately, then create users from /admin/users
```

See `SETUP.md` for full prerequisites and reverse-proxy notes.

## Project layout

```
src/
  src/
    app.html                              ← PWA meta, theme, manifest links
    app.d.ts                              ← App.Locals.user typing
    hooks.server.ts                       ← auth gate (JWT cookie → locals.user)
    lib/
      db.ts                               ← TypeORM SQLite, synchronize: true
      entities/
        Settings.ts                       ← app settings (integrations)
        User.ts                           ← WATCHERR users (+ mode column)
        LoginEvent.ts                     ← login attempt audit
        AppConfig.ts                      ← key/value (session secret)
        Addon.ts                          ← installed Stremio addon manifests
        TmdbImdbMap.ts                    ← TMDB→IMDB id cache (positive + negative)
      server/
        auth/
          password.ts                     ← bcryptjs hash/verify (cost 12)
          jwt.ts                          ← sign/verify, AUTH_COOKIE
          sessionSecret.ts                ← env > DB > generate
          rateLimit.ts                    ← 5/60s sliding window per IP
          requireAdmin.ts                 ← 401/403 guard for API
          bootstrap.ts                    ← seed default admin
        jellyfin/
          adminClient.ts                  ← X-Emby-Token list users / set pw
          passwordSync.ts                 ← graceful sync wrapper
        addons/                           ← Online Mode server-side (v29+)
          types.ts                        ← NormalizedStream/Subtitle, AddonError
          streamNormalizer.ts             ← parse Stremio stream → quality/size/seeders
          manifestClient.ts               ← fetch + validate Stremio manifest
          streamAggregator.ts             ← parallel query enabled addons, LRU+TTL cache
          subtitleAggregator.ts           ← same, for /subtitles resource
          subtitleToken.ts                ← HMAC-signed proxy tokens
          streamCache.ts                  ← in-memory LRU with TTL
          tmdbImdb.ts                     ← TMDB→IMDB resolver + cache
    routes/
      +layout.server.ts                   ← passes user into layout data
      login/                              ← BackgroundSlideshow + form
      profile/                            ← change password / sign out
      admin/                              ← admin panel (gated by +layout.server.ts)
        users/                            ← CRUD + modals
        system/                           ← integration health
        activity/                         ← last 50 login events
      api/
        auth/{login,logout,change-password,backdrops}/+server.ts
        admin/users/+server.ts            ← list/create
        admin/users/[id]/+server.ts       ← edit/delete
        admin/users/[id]/{reset-password,force-logout,sync-jellyfin-password}/+server.ts
        admin/jellyfin-users/+server.ts   ← dropdown source
        admin/login-events/+server.ts
        admin/addons/+server.ts           ← Online Mode: list/install addons
        admin/addons/[id]/+server.ts      ← enable/disable/reorder/delete
        admin/addons/[id]/refresh/+server.ts   ← re-fetch manifest
        admin/addons/validate/+server.ts  ← dry-run manifest validation
        profile/mode/+server.ts           ← PATCH user.mode
        stream/movie/[tmdbId]/+server.ts  ← aggregate streams
        stream/series/[tmdbId]/[season]/[episode]/+server.ts
        subtitles/movie/[tmdbId]/+server.ts
        subtitles/series/[tmdbId]/[season]/[episode]/+server.ts
        subtitles/proxy/+server.ts        ← HMAC-gated passthrough proxy
  static/
    manifest.webmanifest, favicon.svg, logo_*.svg, apple-touch-icon.png, icons/
docs/                                     ← you are here
```

## Documentation index

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — auth model, data flow, key decisions
- **[SETUP.md](SETUP.md)** — install, config, deploy
- **[API.md](API.md)** — every endpoint with request/response shapes
- **[USAGE.md](USAGE.md)** — admin workflows, user workflows, troubleshooting
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — local dev, code style, testing

## Status

Stack: SvelteKit (Svelte 3) + TypeORM + SQLite + bcryptjs + jsonwebtoken + Tailwind. Node 18 Alpine in production.

## License

GPL-3.0. See LICENSE.
