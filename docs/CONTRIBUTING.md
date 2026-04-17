# Contributing

WATCHERR is a self-hosted media request and management UI for Jellyfin, Sonarr, and Radarr.

## Local dev

```bash
cd watcherr/src
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

- Hot reload via Vite.
- SQLite file is created in the project root on first run if no `/config` mount is present.
- Default admin `admin` / `changeme123` is seeded on first request.

## Scripts

```bash
npm run dev          # Vite dev server
npm run build        # SvelteKit production build (@sveltejs/adapter-node)
npm run preview      # Serve the production build locally
npm run check        # svelte-check (TypeScript + Svelte a11y)
npm run lint         # ESLint + Prettier check
npm run format       # Prettier write
npm test             # Vitest (unit tests)
```

`npm run check` should report **zero new errors** on PRs. The upstream baseline has some non-WATCHERR warnings we don't touch.

## Repo layout

```
watcherr/
├── docker-compose.yml           ← production compose
└── src/                          ← SvelteKit app
    ├── docs/                     ← you are here
    ├── src/
    │   ├── hooks.server.ts       ← auth gate
    │   ├── lib/
    │   │   ├── entities/         ← TypeORM entities (User, LoginEvent, AppConfig, Addon, TmdbImdbMap)
    │   │   ├── server/auth/      ← bcrypt, jwt, session secret, rate limit, requireAdmin, bootstrap
    │   │   ├── server/jellyfin/  ← admin client + password sync wrapper
    │   │   └── server/addons/    ← Online Mode: manifest client, stream/subtitle aggregators, LRU cache, HMAC tokens
    │   └── routes/
    │       ├── login/            ← login page + BackgroundSlideshow
    │       ├── profile/          ← change password / sign out
    │       ├── admin/            ← admin panel
    │       └── api/              ← +server.ts endpoints
    ├── static/                   ← PWA manifest, favicon, logos, icons
    ├── Dockerfile                ← multi-stage (deps / build / production)
    └── package.json
```

## Code conventions

- TypeScript strict mode.
- TypeORM `synchronize: true` — add entities and let TypeORM mutate the schema. No migration files.
- No SSR: `export const ssr = false` in `src/routes/+layout.ts`. Auth is enforced in `hooks.server.ts` for initial document requests, and in `+layout.server.ts` / `+page.server.ts` for data loads.
- Tailwind for styling. `font-display` = Nunito Sans, `font-sans` = Inter.
- Svelte 3 syntax (`let`/`$:`, no runes).

## WATCHERR-specific conventions

- **Server-only code lives under `$lib/server/`.** SvelteKit refuses to bundle it into the client, which is required for `bcryptjs`, `jsonwebtoken`, the session secret, and the Jellyfin admin key.
- **Every `/api/admin/*` handler calls `requireAdmin(event)` first.** Don't duplicate the 401/403 branching.
- **Sensitive fields are never returned to the client.** `passwordHash`, `tokenVersion`, and full Jellyfin tokens are stripped before serialization.
- **Password operations bump `tokenVersion`** (change-password, admin reset). Use `user.tokenVersion++` then save; the hook does the rest.
- **Jellyfin sync is best-effort.** `syncJellyfinPassword()` returns `boolean`. Never throw from a sync failure — bubble a `jellyfinSynced` flag up to the UI so the admin can retry.
- **Real-Debrid keys stay server-side.** Anything touching `addons.manifestUrl` lives under `$lib/server/addons/`. When returning addon rows to the client, strip `manifestUrl` down to `baseUrl` only if you display it (see `/admin/addons/+server.ts`). Treat the manifest URL like a credential — logs, error messages, and toasts must never echo it back.
- **Subtitle proxy tokens are HMAC-signed.** Every upstream URL is wrapped in `/api/subtitles/proxy?token=<signed>` with a 60-minute expiry. Verify with `crypto.timingSafeEqual` — never raw string compare. Keep the secret pulled from `getSessionSecret()`; do not introduce a separate HMAC key.
- **Addon failures are soft errors.** `streamAggregator` uses `Promise.allSettled` with 8s timeouts per addon. A bad addon returns an entry in `errors[]`; it must not 500 the whole route.

## Testing

Unit tests use Vitest. Server-only modules (JWT signing, bcrypt, rate limit) have tests under `src/lib/server/auth/*.test.ts`.

Guidelines:
- Tests that touch the DB use a throwaway SQLite in memory — don't mock TypeORM.
- Don't mock `bcryptjs`. It's fast enough at cost 12 in tests and mocking it has masked real bugs in auth before.
- Integration-style tests for endpoints go under `src/routes/**/*.test.ts` and hit the handler function directly (SvelteKit doesn't provide a test harness).
- For `$lib/server/addons/`: `manifestClient` and aggregator tests stub `fetch` (return canned Stremio manifest / stream JSON). Don't hit live Torrentio in tests — it's rate-limited and flaky.
- `streamNormalizer` tests use inline Torrentio-shaped fixtures. Add a case before changing quality/size/seeder parsing.
- `subtitleToken` tests sign with a fixed session secret, then tamper with one byte and assert `timingSafeEqual` rejection.

## PR checklist

- [ ] `npm run check` — no new errors
- [ ] `npm run lint` — clean
- [ ] `npm test` — all pass
- [ ] Manually exercised the affected flow in a browser (auth changes especially)
- [ ] If entities changed, verified `synchronize: true` produces the expected column on a fresh DB
- [ ] If public API changed, updated `docs/API.md`
- [ ] If admin UX changed, updated `docs/USAGE.md`

## Release

1. Bump image tag in `watcherr/docker-compose.yml` (`watcherr:vN` → `vN+1`).
2. `docker build --target production -t watcherr:vN+1 watcherr/src`
3. Before swapping, tag the outgoing image as a fallback: `docker tag watcherr:vN watcherr:vN-stable`.
4. `docker compose up -d`
5. Watch `docker logs -f watcherr` for the "Data Source has been initialized!" + "Listening on 0.0.0.0:9494" lines.
6. If any entities changed, confirm the expected `CREATE TABLE …` / `ALTER TABLE …` lines appear during boot.

## License

GPL-3.0. See `../LICENSE`.
