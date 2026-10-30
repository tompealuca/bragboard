# Run Bragboard on a Raspberry Pi

The whole backend is one Docker container: [PocketBase](https://pocketbase.io) with the Bragboard schema and the web app inside. It uses about 30–60 MB of RAM, so a Raspberry Pi 4 handles it easily, next to other things.

You end up with:

- `https://your-address/` the web app (also installable on phones)
- `https://your-address/api/` the API the Android/iPhone apps use
- `https://your-address/_/` the admin panel (users, data, backups, email settings)

## 1. Prepare the Pi

1. Flash **Raspberry Pi OS Lite (64-bit)** with [Raspberry Pi Imager](https://www.raspberrypi.com/software/). In the Imager settings: set a hostname (e.g. `bragboard`), enable SSH, set your user and Wi-Fi. A USB SSD instead of an SD card lasts longer, but an SD card works.
2. Log in: `ssh <user>@bragboard.local`
3. Update and install Docker:

   ```bash
   sudo apt update && sudo apt full-upgrade -y
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   exit   # log in again so the docker group applies
   ```

> The image is built for `arm64`. Check with `uname -m` → it must say `aarch64` (64-bit OS).

## 2. Start Bragboard

```bash
git clone https://github.com/tompealuca/bragboard.git
cd bragboard/deploy
cp .env.example .env
nano .env                 # set your time zone
docker compose up -d
docker compose ps         # STATUS should become "healthy"
```

The image comes from GitHub Container Registry and is rebuilt automatically on every push to `main`.

- If `docker compose up` says *unauthorized* or *denied*, the image package is still private: on GitHub open your profile → **Packages** → **bragboard** → **Package settings** → **Change visibility** → Public. (Or run `docker login ghcr.io` with a token that has `read:packages`.)
- To build on the Pi instead (takes ~10 minutes): in `docker-compose.yml` uncomment `build: ..`, then `docker compose up -d --build`.

Create your admin account (this is for the admin panel, separate from your normal app account):

```bash
docker compose exec bragboard /pb/pocketbase superuser upsert you@example.com 'a-long-admin-password' --dir=/pb/pb_data
```

Open `http://bragboard.local:8090` — the app should load. `http://bragboard.local:8090/_/` is the admin panel.

## 3. Make it reachable from anywhere

Phones on mobile data need a public HTTPS address. Both options below are free, need **no port forwarding** and work behind any router (also CGNAT). Your home IP stays hidden.

### Option A: Tailscale Funnel (free, no domain needed)

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up            # log in with the link it prints
sudo tailscale funnel --bg 8090
```

The first time, Tailscale asks you to enable HTTPS and Funnel for your tailnet (it prints a link, one click). Your address is shown by `tailscale funnel status`, something like `https://bragboard.tail1234.ts.net`. It survives reboots.

### Option B: Cloudflare Tunnel (your own domain, e.g. `scores.yourname.com`)

Needs a domain using Cloudflare's free plan (domains cost about €10/year).

1. Cloudflare dashboard → **Zero Trust** → **Networks** → **Tunnels** → **Create a tunnel** → *Cloudflared* → name it `bragboard`.
2. Choose *Docker* and copy the token (the long string after `--token`). Put it in `deploy/.env` as `CLOUDFLARE_TUNNEL_TOKEN=...`.
3. In the tunnel's **Public hostname** tab add: subdomain `scores`, your domain, service type `HTTP`, URL `bragboard:8090`.
4. Start it: `docker compose --profile cloudflare up -d`

Tip: with Cloudflare you can protect only the admin panel with *Zero Trust → Access* (an application for `scores.yourname.com/_/*`), so only your email can open it.

## 4. Admin settings (once)

Open `https://your-address/_/` and sign in with the admin account.

1. **Settings → Application**: set *Application URL* to your public address (used in emails).
2. **Settings → Mail settings**: needed for "Forgot password" emails. Any SMTP works, for example a Gmail account with an [app password](https://myaccount.google.com/apppasswords) (`smtp.gmail.com`, port 587) or Brevo's free plan. Send a test email.
3. **Settings → Backups**: turn on automatic backups (for example cron `0 3 * * *`, keep 7). Optionally store them off the Pi in S3-compatible storage (Backblaze B2 and Cloudflare R2 have free tiers).
4. **Settings → Rate limits**: already on (e.g. 2 login attempts per 3 seconds per IP). No change needed.

## 5. Point the apps at your server

- **Web / PWA**: just use your public address.
- **Android / iPhone builds**: put your address in `client/eas.json` (`EXPO_PUBLIC_API_URL`) before building, see [MOBILE_APPS.md](MOBILE_APPS.md).
- Anyone can also change the server in the app: on the sign-in screen tap **Server: …** at the bottom.

## Updating

```bash
cd ~/bragboard/deploy && ./update.sh
```

Automatic nightly update: `crontab -e` and add

```
0 4 * * * /home/<user>/bragboard/deploy/update.sh >> /home/<user>/bragboard-update.log 2>&1
```

Database changes ship as migrations in `server/pb_migrations` and are applied automatically when the new container starts.

## Backups and restore

All data is in `deploy/pb_data`. Besides the built-in backups:

```bash
docker compose stop bragboard
tar czf ~/bragboard-$(date +%F).tgz pb_data
docker compose start bragboard
```

Restore: stop the container, replace `pb_data` with the backup, start it again. In the admin panel you can also restore a backup with one click.

## Troubleshooting

| Problem | Try |
|---|---|
| App says "Can't reach the server" | `docker compose ps`, `docker compose logs -f bragboard`, open `https://your-address/api/health` |
| Funnel address doesn't load | `tailscale funnel status`; Funnel only allows ports 443/8443/10000 publicly, which the command above handles |
| Cloudflare 502 | the tunnel's service URL must be `http://bragboard:8090` (container name, not localhost) |
| Forgot admin password | run the `superuser upsert` command again with a new password |
| Moving to a VPS later | copy `pb_data` and the `deploy` folder to the new machine, `docker compose up -d` |
