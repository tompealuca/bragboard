// Fills a LOCAL development server with demo accounts, games and sessions.
//
//   node --experimental-strip-types server/scripts/seed-demo.mjs
//
// Env: PB_URL (default http://127.0.0.1:8090), PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD (a superuser).
// Never run this against your real server.
//
// Demo accounts (all with password DEMO_PASSWORD below):
//   luca_demo, ana_demo, bob_demo, cid_demo
// eve_demo is reserved for trying the sign-up screen by hand.

import { computeResults, emptySessionData } from '../../client/src/lib/scoring.ts';

const PB = process.env.PB_URL || 'http://127.0.0.1:8090';
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD;
const DEMO_PASSWORD = 'bragboard-demo';

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD (a superuser of your local server).');
  process.exit(1);
}
if (!/127\.0\.0\.1|localhost/.test(PB)) {
  console.error('Refusing to seed a non-local server:', PB);
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let token = '';

async function api(method, path, body) {
  // stay under the default rate limit (20 creates / 5 s)
  if (method !== 'GET') await sleep(280);
  const res = await fetch(PB + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json)}`);
  return json;
}

// deterministic pseudo random numbers so every run looks the same
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (list) => list[int(0, list.length - 1)];

const auth = await api('POST', '/api/collections/_superusers/auth-with-password', {
  identity: ADMIN_EMAIL,
  password: ADMIN_PASSWORD,
});
token = auth.token;

async function ensureUser(username, name) {
  const found = await api('GET', `/api/collections/users/records?filter=${encodeURIComponent(`username="${username}"`)}`);
  if (found.items.length) return found.items[0];
  return api('POST', '/api/collections/users/records', {
    username,
    name,
    email: `${username}@example.test`,
    password: DEMO_PASSWORD,
    passwordConfirm: DEMO_PASSWORD,
    verified: true,
  });
}

const luca = await ensureUser('luca_demo', 'Luca');
const ana = await ensureUser('ana_demo', 'Ana');
const bob = await ensureUser('bob_demo', 'Bob');
const cid = await ensureUser('cid_demo', 'Cid');
const people = { luca, ana, bob, cid };
const asParticipant = (u) => ({ key: `u:${u.id}`, userId: u.id, name: u.name });
const grandma = { key: 'g:grandma', name: 'Grandma' };

for (const friend of [ana, bob, cid]) {
  await api('POST', '/api/collections/friends/records', { owner: luca.id, friend: friend.id }).catch(() => {});
}
await api('POST', '/api/collections/friends/records', { owner: ana.id, friend: luca.id }).catch(() => {});

async function ensureGame(name, emoji, color, config) {
  const found = await api(
    'GET',
    `/api/collections/games/records?filter=${encodeURIComponent(`name="${name}" && owner="${luca.id}"`)}`,
  );
  if (found.items.length) return found.items[0];
  return api('POST', '/api/collections/games/records', { name, emoji, color, config, owner: luca.id });
}

const games = {
  catan: await ensureGame('Catan', '🏝️', '#FF9F1C', { mode: 'points' }),
  whist: await ensureGame('Whist', '🃏', '#6366F1', {
    mode: 'rounds',
    bidding: { exact: 5, perTrick: 1, missPerTrick: 1 },
    trackDuration: true,
  }),
  uno: await ensureGame('Uno', '🟥', '#FF6B5A', { mode: 'rounds', targetScore: 500 }),
  wonders: await ensureGame('7 Wonders', '🏛️', '#F2B705', {
    mode: 'categories',
    categories: ['Military', 'Treasury', 'Wonder', 'Civilian', 'Commerce', 'Guilds', 'Science'],
  }),
  chess: await ensureGame('Chess', '♟️', '#64748B', { mode: 'winner', allowDraw: true }),
  codenames: await ensureGame('Codenames', '🕵️', '#E84393', { mode: 'winner', teams: 'always' }),
  kart: await ensureGame('Mario Kart', '🏎️', '#2EB872', { mode: 'ranking' }),
  pandemic: await ensureGame('Pandemic', '🦠', '#14A3A3', { mode: 'coop' }),
};

const existing = await api('GET', `/api/collections/sessions/records?perPage=1`);
if (existing.totalItems > 0) {
  console.log('Sessions already exist, skipping session seeding.');
  process.exit(0);
}

let daysAgo = 75;
async function saveSession(game, participants, fill, minutes) {
  const data = emptySessionData(game.config, participants);
  fill(data);
  const results = computeResults(game.config, data);
  daysAgo = Math.max(0, daysAgo - int(1, 3));
  const playedAt = new Date(Date.now() - daysAgo * 86400000 - int(0, 5) * 3600000);
  await api('POST', '/api/collections/sessions/records', {
    game: game.id,
    created_by: luca.id,
    players: participants.filter((p) => p.userId).map((p) => p.userId),
    played_at: playedAt.toISOString(),
    duration_min: minutes ?? 0,
    notes: '',
    data,
    results,
  });
}

const all = [luca, ana, bob, cid].map(asParticipant);
const skill = { luca: 1.15, ana: 1.25, bob: 0.95, cid: 0.85 };
const skillOf = (p) => skill[Object.keys(people).find((k) => `u:${people[k].id}` === p.key)] ?? 0.9;

for (let i = 0; i < 40; i++) {
  const which = pick(['catan', 'catan', 'whist', 'uno', 'wonders', 'chess', 'codenames', 'kart', 'pandemic']);
  const game = games[which];
  switch (which) {
    case 'catan': {
      const ps = rand() > 0.4 ? all : all.slice(0, 3);
      await saveSession(game, ps, (d) => {
        for (const p of ps) d.scores[p.key] = Math.min(10, Math.round(int(4, 9) * skillOf(p)));
      }, int(60, 120));
      break;
    }
    case 'whist': {
      await saveSession(game, all, (d) => {
        for (let r = 0; r < 8; r++) {
          const round = {};
          for (const p of all) {
            const bid = int(0, 3);
            const hit = rand() < 0.45 * skillOf(p);
            round[p.key] = { bid, took: hit ? bid : Math.max(0, bid + pick([-1, 1, 2])) };
          }
          d.bids.push(round);
        }
      }, int(45, 90));
      break;
    }
    case 'uno': {
      const ps = [...all.slice(0, 3), grandma];
      await saveSession(game, ps, (d) => {
        const totals = Object.fromEntries(ps.map((p) => [p.key, 0]));
        while (Math.max(...Object.values(totals)) < 500) {
          const winner = pick(ps);
          const round = {};
          for (const p of ps) round[p.key] = p === winner ? int(40, 160) : 0;
          d.rounds.push(round);
          for (const p of ps) totals[p.key] += round[p.key];
        }
      }, int(30, 60));
      break;
    }
    case 'wonders': {
      await saveSession(game, all, (d) => {
        for (const p of all) {
          d.categories[p.key] = {};
          for (const c of game.config.categories) d.categories[p.key][c] = Math.round(int(-2, 12) * skillOf(p));
        }
      }, int(30, 45));
      break;
    }
    case 'chess': {
      const ps = [asParticipant(luca), asParticipant(bob)];
      await saveSession(game, ps, (d) => {
        const r = rand();
        if (r < 0.15) d.draw = true;
        else d.winners = [r < 0.6 ? ps[0].key : ps[1].key];
      });
      break;
    }
    case 'codenames': {
      await saveSession(game, all, (d) => {
        d.winners = [pick(['t:0', 't:1'])];
      });
      break;
    }
    case 'kart': {
      await saveSession(game, all, (d) => {
        const order = [...all].sort((a, b) => skillOf(b) * rand() - skillOf(a) * rand());
        order.forEach((p, idx) => (d.ranks[p.key] = idx + 1));
      });
      break;
    }
    case 'pandemic': {
      await saveSession(game, all.slice(0, 3), (d) => {
        d.coopWon = rand() > 0.45;
      }, int(40, 70));
      break;
    }
  }
  process.stdout.write('.');
}
console.log('\nSeeded demo data. Sign in as luca_demo.');
