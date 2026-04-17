# Usage

## First-time setup

1. Deploy per `SETUP.md` → browse to `http://<host>:9494`.
2. Log in as `admin` / `changeme123` (the seeded default admin).
3. Navigate to `/profile` → **Change password**. Pick something strong.
4. (If using Jellyfin) configure Jellyfin URL + admin API key from the WATCHERR **Settings** page. This is what enables:
   - The Jellyfin user dropdown on admin create/edit forms
   - Automatic password sync
   - The "Jellyfin: OK" light on `/admin/system`
5. Create real users from `/admin/users`.

## Admin workflows

All admin pages live under `/admin` and are visible only to users with `isAdmin = true`. Non-admins who somehow hit the URL get redirected to `/`.

### Create a user

`/admin/users` → **New user** button.

Fields:
- **Username** — lowercase letters/digits/`_.-`, 3–32 chars. Stored lowercased.
- **Password** — minimum 8 chars.
- **Admin** — checkbox; grants full admin access (can manage other users, access integration settings).
- **Link to Jellyfin account** — optional dropdown populated from the configured Jellyfin server.

On submit:
- User is created.
- If linked, WATCHERR pushes the plaintext password to Jellyfin's `/Users/{id}/Password` endpoint.
- Toast: "User created" or "User created, Jellyfin sync failed" depending on outcome.

### Reset a password

`/admin/users` → **Reset password** on the row.

Prompts for a new password. On save:
- User's `tokenVersion` is bumped — they're signed out of every session.
- If linked to Jellyfin, the new password is pushed there too.
- Toast reflects the Jellyfin result; on failure, use **Sync Jellyfin password** with the same plaintext.

### Edit a user

`/admin/users` → **Edit**. Change username, admin flag, or Jellyfin link.

Guardrails:
- You cannot un-admin yourself.
- You cannot un-admin the last remaining admin.
- Changing the Jellyfin link alone does **not** push a password. Follow up with **Reset password** if the two systems need to sync.

### Delete a user

**Delete** button with a confirm modal. Same last-admin / self-delete guards as edit.

### Force-logout

Bumps `tokenVersion` without changing anything else. Use when:
- A shared device needs to be signed out remotely.
- You suspect credential compromise and want to invalidate open sessions before the user changes their own password.

### Unified password retry

If the toast says "Jellyfin sync failed":
1. Open the user row.
2. Click **Retry Jellyfin sync**.
3. Re-enter the same password (WATCHERR has already stored its bcrypt hash; it needs plaintext only to forward to Jellyfin).
4. Expect success. If it fails again, check `/admin/system` — Jellyfin may be down or the API key invalid.

### System health

`/admin/system` shows live pings for:
- **Jellyfin** — `GET /System/Info` with `X-Emby-Token`
- **Sonarr** — `GET /api/v3/system/status` with API key
- **Radarr** — same for Radarr
- Total user count

Each is a green/red dot. Click the service name to open its admin URL in a new tab.

### Login activity

`/admin/activity` shows the last 50 login events across all users (including failures against unknown usernames). Columns: timestamp, username, IP, success/fail.

Use this to:
- Audit who signed in recently.
- Spot brute-force attempts (same IP, many failures in a short window).

## User workflows

### Sign in

`/login` — username + password. On success, lands on `/` (the WATCHERR home page).

If you forgot your password, there is no self-serve reset. Ask an admin to reset it from `/admin/users`.

### Change own password

`/profile` → **Change password**. Needs current password + new (>=8 chars) twice.

Effects:
- All *other* sessions are signed out (current session stays active).
- If linked to Jellyfin, Jellyfin is updated too. Toast shows the result.

### Sign out

`/profile` → **Sign out**. Clears the cookie. Next request redirects to `/login`.

### Pick your mode (Request vs Online)

WATCHERR supports two playback modes per user (v29+):

- **Request Mode** — the classic flow. Movies go through Radarr, series through Sonarr, then land in Jellyfin for playback.
- **Online Mode** — instant streaming via admin-installed Stremio-compatible addons (e.g. Torrentio + Real-Debrid). No waiting for a download to finish; you press **Stream** and the player opens.

**First login:** a card picker appears asking you to choose. The choice is saved to `users.mode` and determines which button (Request vs Stream) you see on movie / episode pages.

**Change later:** `/profile` → **Playback mode** toggle.

### Stream a movie (Online Mode)

1. Open a movie page. Instead of **Request**, you'll see an amber **Stream** button.
2. Click it → `StreamListModal` opens, lists every source returned by the enabled addons.
3. Filter/sort by quality (4K / 1080p / 720p / 480p), size, or seeders. Search by release-group text.
4. Click a row → the built-in player opens (`VideoPlayer`), loads the direct HTTPS URL (already Real-Debrid-resolved server-side), and surfaces available subtitles as `<track>` elements.
5. Resume/seek is handled by the browser since the URL is a plain MP4/MKV served with range support.

### Stream a series episode (Online Mode)

1. Open a series page. You'll see **Stream Series** (addons that match by IMDB id) next to the season tabs.
2. Or open a specific season — each episode card has a **Stream** button.
3. The modal is identical to the movie one; the underlying query is `GET /api/stream/series/{tmdbId}/{season}/{episode}`.

### Subtitles

When an addon implements Stremio's `subtitles` resource, WATCHERR proxies the subtitle file through `/api/subtitles/proxy?token=<HMAC>`. The token expires 60 minutes after issuance, so if you sit on a page for hours before clicking play, re-open the stream modal to refresh the list.

Currently two languages are auto-mapped into the player overlay: English and Arabic. Other languages come through as raw `<track>` elements that most browsers expose in the native subtitle menu.

## Admin — Online Mode workflows (v29+)

### Install a Stremio addon

`/admin/addons` → **Install addon**.

1. Paste a full manifest URL, e.g.:
   ```
   https://torrentio.strem.fun/realdebrid=YOUR_RD_API_KEY/manifest.json
   ```
   (Real-Debrid key is part of the URL — that's the Torrentio convention.)
2. Click **Validate** — WATCHERR fetches and parses the manifest, showing the addon name and its advertised resources/types.
3. Click **Install** — the full URL (including your RD key) is stored server-side on the `addons` row. It is never sent to a browser.

**Important:** the manifest URL is treated as a secret. Do not share it. If you rotate your RD key, delete and re-install the addon.

### Enable / disable / reorder

Each addon row has an **Enabled** checkbox — unchecking it removes the addon from stream aggregation without deleting it. **Sort order** controls the default query order (not user-visible — the stream list sorts by quality/size/seeders regardless).

### Refresh a manifest

`/admin/addons` → **Refresh** on the row. Re-fetches the manifest URL and updates `resources`, `types`, and `lastCheckedAt`. Do this if the addon publisher adds new resource types (e.g. subtitles support).

### Delete an addon

`/admin/addons` → **Delete**. Instant, no confirm. Users will stop seeing streams from that source on their next click.

### Typical addon set

A reasonable starter set for Online Mode:

| Addon | Manifest URL template | Notes |
|-------|-----------------------|-------|
| Torrentio (Real-Debrid) | `https://torrentio.strem.fun/realdebrid=RD_KEY/manifest.json` | Primary source; RD returns direct HTTPS URLs. |
| OpenSubtitles v3 | `https://opensubtitles-v3.strem.io/manifest.json` | Subtitles only, no streams. Feed it alongside Torrentio. |

Only admins can install, enable, disable, refresh, or remove addons. Non-admin users never hit `/admin/addons`.

### Install as an app (PWA)

- **iOS Safari**: open the site → Share → Add to Home Screen → "WATCHERR"
- **Android Chrome**: three-dot menu → Install app
- **Desktop Chrome/Edge**: address-bar install icon

The PWA uses the standalone display mode, theme color `#1f2937`, and the maskable icon bundled under `static/icons/`.

## Troubleshooting

### "Too many attempts"

You've exceeded 5 login attempts in 60 seconds from your IP. Wait a minute. If you're behind a shared proxy and this happens often, put a real proxy in front that sends a correct `X-Forwarded-For` so the limiter keys on individual clients, not the shared egress.

### Login works but immediately redirects to `/login`

- Browser is blocking `Secure` cookies on HTTP. Put HTTPS in front (Caddy/Cloudflare/nginx) or flip `Secure` off in `lib/server/auth/jwt.ts` for local-only non-HTTPS testing.
- System clock drift. JWTs have `iat`/`exp`; skew >expiry fails verification.

### Admin link not visible in the navbar

`$page.data.user.isAdmin` is false. Check the user row (`SELECT username, isAdmin FROM users` on the SQLite file) or log in as `admin`.

### Jellyfin sync always fails

From the container:
```bash
docker exec -it watcherr wget -qO- \
  --header "X-Emby-Token: <your admin key>" \
  http://<jellyfin>:8096/System/Info
```
If that fails, the URL/API key stored in `Settings` are wrong. Fix them in the Settings UI. If it succeeds but sync still fails, open `/admin/system` — there's likely a more specific error.

### I want to wipe everything and start over

```bash
docker compose down
rm -rf appdata/
docker compose up -d
```

Fresh SQLite, fresh default admin, fresh session secret.

### Forgot the admin password with no other admin

See "Resetting the admin password" in `SETUP.md`. TL;DR: delete the `admin` row with sqlite3, restart — bootstrap re-seeds the default.

### Stream button is missing on a movie/series page

- Your user mode is `request` (or `null`). Go to `/profile` → **Playback mode** → pick **Online**.
- Or there are no enabled addons in `/admin/addons`. Install at least one that advertises the `stream` resource (e.g. Torrentio).

### Stream list is empty or only shows errors

Every addon failure surfaces as a soft error in the modal, not a hard 500. Check:

- **Addon timed out** — Stremio addons can be slow. 8s per addon is the upper bound; if every call times out, the addon host is down. Test the manifest URL in a browser.
- **No results** — the content genuinely has no seeded torrents for that title. Switch addons or wait.
- **Real-Debrid rate-limit** — RD returns HTTP 429 under heavy use. Results will still show; they just won't be RD-resolved. Torrentio handles this transparently but you may see fewer direct-play rows.

### Subtitle track shows "downloading…" forever

The subtitle proxy upstream request timed out (8s limit). Pick a different track or reload the stream modal to get fresh signed URLs.

### Installed an addon but it doesn't appear in stream lists

- Confirm **Enabled** is checked on `/admin/addons`.
- Click **Refresh** on the row — if it now 404s, the manifest moved.
- Check container logs: `docker logs watcherr 2>&1 | grep -i addon`.

### Addon manifest includes my Real-Debrid key — is that a problem?

The key is stored server-side only, in the SQLite `addons.manifestUrl` column. It never crosses into a browser response. The stream URLs that do cross to the client are already RD-debrided — they are direct HTTPS links to the cached file, not URLs containing your key. Rotate your RD key periodically as general hygiene; if you do, re-install the addon with the new key.

### Mobile install icon shows a blurry "W"

The icons under `static/icons/` are programmatically generated (the build host lacked ImageMagick/librsvg). Replace them with hand-crafted artwork — keep the filenames:
- `icon-192.png` (192×192)
- `icon-512.png` (512×512)
- `icon-512-maskable.png` (512×512 with safe-area padding)
- `../apple-touch-icon.png` (180×180)

Rebuild the image and redeploy.
