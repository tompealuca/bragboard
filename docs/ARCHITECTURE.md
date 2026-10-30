# Architecture and decisions

## The choices, in short

| Question | Choice | Why |
|---|---|---|
| Do we need a server? | **Yes, a small one.** | Accounts, friends, and "a game I'm in appears on my profile" need one shared source of truth. A phone-only app can't sync between people. |
| Which server? | **PocketBase** (single Go binary + SQLite) | Login, password reset, database, access rules, live updates, file storage, backups and an admin panel out of the box. ~15 MB, runs great on a Pi. No server code to maintain. |
| Where? | **Your Raspberry Pi in Docker**, exposed by **Tailscale Funnel** or **Cloudflare Tunnel** | Free, private data, HTTPS without port forwarding, hides your home IP. Moving to a €4/month VPS later is copying one folder. |
| App framework | **Expo (React Native) + Expo Router** | One TypeScript codebase for Android, iPhone and web; cloud builds without a Mac. |
| Web hosting | **Served by PocketBase itself** (`pb_public`) | Same origin as the API: no CORS, one address, one container. |
| Statistics | **Computed on the device** from stored results | Data per user is small (hundreds or thousands of sessions); instant filtering by any player combination; works offline from cache. |

Alternatives considered: Supabase / Firebase free tiers (no hardware, but projects pause or have limits, data at a third party); a custom Node.js API (more code to write and secure, especially auth and email). PocketBase gives the best ease/cost ratio for a self-hosted friends app.

## Data model

Defined in [`server/pb_migrations/1761800000_init_schema.js`](../server/pb_migrations/1761800000_init_schema.js).

```
users (auth)      id, email (private), username (unique, a–z 0–9 _ .), name, avatar, password…
games             id, name, emoji, color, description, config (JSON scoring rules), owner → users
sessions          id, game → games, created_by → users, players → users[] (linked accounts),
                  played_at, duration_min, notes,
                  data (JSON: participants incl. guests, teams, raw scores/rounds/bids/sheet/ranks/winners),
                  results (JSON: per participant score, rank, won, draw)
friends           id, owner → users, friend → users   (unique pair)
```

A *game* is a game type (Catan). A *session* is one played match: it has an id, a game, and a list of participants. Participants with an account are also stored in `players`, which is what makes the session show up on their profile and in their stats. Guests only live in `data.participants`.

`config` examples:

```json
{ "mode": "points", "lowestWins": false, "teams": "optional" }
{ "mode": "rounds", "targetScore": 500 }
{ "mode": "rounds", "bidding": { "exact": 5, "perTrick": 1, "missPerTrick": 1 }, "trackDuration": true }
{ "mode": "categories", "categories": ["Military", "Treasury", "Science"] }
{ "mode": "winner", "allowDraw": true, "teams": "always" }
{ "mode": "coop", "coopScore": true }
```

## Who can see and change what

Enforced by the server (PocketBase API rules), tested in CI by [`server/tests/access-rules.mjs`](../server/tests/access-rules.mjs).

| | See | Create | Edit | Delete |
|---|---|---|---|---|
| users | signed-in users see username + name (never email) | anyone (sign up) | yourself | yourself |
| games | owner, and anyone with a session of that game | yourself as owner | owner | owner, while all its sessions are theirs |
| sessions | creator and every linked participant | yourself as creator | creator and participants | creator |
| friends | both people in the pair | yourself as owner | – | owner |

Rate limiting is on (logins: 2 per 3 s per IP, creates: 20 per 5 s, overall API: 300 per 10 s).

## API

The app uses PocketBase's REST API through the [JS SDK](https://github.com/pocketbase/js-sdk):

| Action | Request |
|---|---|
| Sign up / sign in | `POST /api/collections/users/records`, `POST /api/collections/users/auth-with-password` (email **or** username) |
| Password reset | `POST /api/collections/users/request-password-reset` |
| Games | `GET/POST/PATCH/DELETE /api/collections/games/records` |
| Sessions | `GET /api/collections/sessions/records?sort=-played_at&fields=…` (list without raw input), `GET …/records/:id` (full) |
| Friends | `GET /api/collections/friends/records?expand=owner,friend`, `POST`, `DELETE` |
| Find users | `GET /api/collections/users/records?filter=username~'ana'` |
| Live updates | `GET /api/realtime` (Server-Sent Events) subscribed to `sessions`, `games`, `friends` |

The full, always-current reference for your instance is in the admin panel: `/_/` → a collection → **API Preview**.

## Scoring engine

[`client/src/lib/scoring.ts`](../client/src/lib/scoring.ts) turns a session's raw `data` into `results`, for every mode:

1. **Entities**: the participants, or the teams (`t:0`, `t:1`…) when playing in teams.
2. **Totals**: final score, sum of rounds, bid points (`exact + bid × perTrick`, or `−|took − bid| × missPerTrick`), or sum of score-sheet categories.
3. **Ranks**: competition ranking ("1, 1, 3"), lowest-wins aware; or the tapped finishing order; or winners/draw; co-op ranks everyone first.
4. **Outcome per participant**: `won` (shared first place counts as a win for each), `draw` when everyone ties, solo sessions are never "wins".

`results` is stored with the session, so statistics never depend on later changes to a game's config. Participant keys are stable across sessions: `u:<userId>` for accounts and `g:<name>` for guests. Linking a guest rewrites `g:mia` to `u:<id>` in every session you created.

## Statistics engine

[`client/src/lib/stats.ts`](../client/src/lib/stats.ts) works only on `results`, so it is identical for every scoring mode: played, wins, draws, losses, win rate, average/best score, average rank, current and longest win streak, head-to-head, cumulative wins over time, records, per-game summaries.

## Sync and offline

- The server is the source of truth. Signing in on any device shows the same data.
- React Query caches everything and saves the cache on the device, so the app opens instantly and can be browsed offline.
- Realtime subscriptions refresh lists when someone else saves a session with you; screens also refresh on focus and pull-to-refresh.
- A session being played is saved on the device (draft) on every change, and uploaded when you press Save.

## Security notes

- Passwords are hashed by PocketBase (bcrypt). Auth tokens are stored on the device and refreshed when the app starts.
- Emails are never visible to other users.
- Keep the admin password long and unique. With Cloudflare you can put the admin panel (`/_/`) behind Cloudflare Access.
- Everything is served over HTTPS by the tunnel.

## Limits and growth

SQLite in PocketBase comfortably handles thousands of users and hundreds of thousands of sessions on a Pi. If it ever outgrows the Pi, move the same container and `pb_data` folder to a VPS.
