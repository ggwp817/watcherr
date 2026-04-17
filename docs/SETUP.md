# Setup

## Prerequisites

- Docker + Docker Compose (production) **or** Node 18+ and npm (local dev)
- A running Jellyfin server (optional, but required for password sync)
- Optional: Sonarr, Radarr instances for media request features
- Optional: reverse proxy (Caddy, nginx, Cloudflare Tunnel) for HTTPS

## Production deploy (Docker)

The repo ships with a working compose file at `watcherr/docker-compose.yml`:

```yaml
name: watcherr
services:
  watcherr:
    image: watcherr:v29
    container_name: watcherr
    restart: unless-stopped
    networks:
      - media-net
    ports:
      - "127.0.0.1:9494:9494"
    volumes:
      - ./appdata:/config
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Asia/Dubai
      - NODE_OPTIONS=--dns-result-order=ipv4first
networks:
  media-net:
    external: true
```

### Build the image

From `watcherr/src/`:

```bash
docker build --target production -t watcherr:v29 .
```

Multi-stage: deps → build (`npm run build`) → production (Node 18 Alpine, runs `node build`).

### First boot

```bash
cd watcherr
docker compose up -d
docker logs -f watcherr
```

Expected log lines:
- `Data Source has been initialized!` — TypeORM synchronized schema
- `[watcherr] seeded default admin user: admin` — default admin created (first boot only)
- `Listening on 0.0.0.0:9494`

Visit `http://<host>:9494` → log in as `admin` / `changeme123` → **immediately change the password** from `/profile`.

### Volumes

- `./appdata:/config` — WATCHERR config mount. The SQLite database (with users, login events, app config) lives here. Back this up.

## Environment variables

All are optional. Sensible defaults apply if unset.

| Variable | Purpose | Default |
|---|---|---|
| `SESSION_SECRET` | HS256 signing key for JWTs. If unset, WATCHERR reads the `session_secret` row in `app_config`; if that is also unset, a 32-byte hex secret is generated and persisted. | auto |
| `TMDB_API_KEY` | Overrides the TMDB key used for backdrops and media browsing. | key from `lib/constants.ts` |
| `NODE_OPTIONS` | Node runtime flags. `--dns-result-order=ipv4first` avoids an IPv6 resolution hang on some hosts. | — |
| `PUID` / `PGID` | File ownership for the mounted `/config` volume. | 1000 / 1000 |
| `TZ` | Timezone for log timestamps. | UTC |

There is **no** `JELLYFIN_URL` or `JELLYFIN_API_KEY` env var — those are configured through the `Settings` UI. The password-sync code reads them from the same config row.

### Online Mode (v29+)

No new environment variables. Stremio addons are installed through the admin UI at `/admin/addons` and stored in SQLite, so they survive container restarts with the rest of the config.

Real-Debrid API keys are part of the addon manifest URL (e.g. `https://torrentio.strem.fun/realdebrid=KEY/manifest.json`), so they live in the `addons.manifestUrl` column — never in an env var. Rotate the key by deleting and re-installing the addon. See `USAGE.md` → "Install a Stremio addon".

## Reverse proxy

The container binds to `127.0.0.1:9494`, so direct public access is blocked by default. Put Caddy, nginx, or Cloudflare Tunnel in front.

### Caddy

```caddy
watcherr.example.com {
    reverse_proxy 127.0.0.1:9494
}
```

### nginx

```nginx
server {
    listen 443 ssl http2;
    server_name watcherr.example.com;

    ssl_certificate /etc/letsencrypt/live/watcherr.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/watcherr.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:9494;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

`X-Forwarded-For` is required so the login rate limiter sees real client IPs. WATCHERR uses the **first** entry in XFF.

### Cloudflare

If Cloudflare is in front, enable "True-Client-IP Header" or rely on `CF-Connecting-IP` being folded into XFF by Caddy/nginx. `Secure` cookie requires HTTPS — terminate TLS at the proxy.

## Local development

From `watcherr/src/`:

```bash
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Opens on `http://localhost:5173`. The dev server uses the same SQLite file via `appdata/` if mounted; otherwise TypeORM creates a new one in the project root.

To reset the dev database and re-seed the default admin:

```bash
rm appdata/watcherr.sqlite
npm run dev
```

On first request, the hook runs `ensureAdminSeeded()` which inserts `admin` / `changeme123` if no admin exists.

## Upgrading

1. `git pull`
2. `docker build --target production -t watcherr:vN watcherr/src`
3. Bump the `image:` tag in `watcherr/docker-compose.yml`
4. `docker compose up -d`

TypeORM `synchronize: true` applies additive schema changes on boot. Destructive column renames or type changes require a manual SQL migration against `appdata/*.db` — there are no migration files shipped.

### v28 → v29 upgrade notes

`v29` adds three schema objects — all handled automatically by `synchronize: true` on first boot:

- `users.mode` column (nullable text) — `null` triggers the first-login mode picker.
- `addons` table — installed Stremio addon manifests, indexed on `(enabled, sortOrder)`.
- `tmdb_imdb_map` table — persistent TMDB→IMDB id cache.

Existing users keep working. On their next login they'll see the mode picker card; picking **Request** matches the legacy behaviour exactly.

To roll back to v28:

```bash
# stop v29
docker compose down
# restore previous image
sed -i 's/watcherr:v29/watcherr:v28-stable/' docker-compose.yml
docker compose up -d
```

v28 ignores the extra columns/tables; no data loss on downgrade.

## Rotating the session secret

Bumping `SESSION_SECRET` invalidates every outstanding JWT (all users signed out).

1. Set `SESSION_SECRET=<new hex>` in the compose file
2. `docker compose up -d`
3. Users re-authenticate on next request

Alternatively, bump a single user's `tokenVersion` from the admin "Force logout" button to sign out just that user.

## Resetting the admin password

If you lose `admin`'s password and no other admin exists:

```bash
docker exec -it watcherr sh
apk add sqlite   # if not present
sqlite3 /config/watcherr.sqlite
# delete the user; bootstrap will re-seed on next boot with the default password
DELETE FROM users WHERE username = 'admin';
.quit
exit
docker compose restart watcherr
```

Default password `changeme123` is restored. Change it immediately.
