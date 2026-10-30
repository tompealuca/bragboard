// Integration test for the API access rules. Needs a running server with the migrations applied:
//   node server/tests/access-rules.mjs            (PB=http://127.0.0.1:8090 by default)
// Creates throwaway users, so run it against a local or CI server only.

// Exercises the PocketBase access rules against a running local server.
const BASE = process.env.PB || "http://127.0.0.1:8090";
let failures = 0;

async function req(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
function check(name, cond, extra) {
  if (cond) console.log("ok   ", name);
  else { failures++; console.log("FAIL ", name, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ""); }
}

const suffix = Date.now().toString(36).slice(-5);
async function makeUser(tag) {
  const username = `${tag}_${suffix}`;
  const email = `${username}@example.test`;
  const r = await req("POST", "/api/collections/users/records", null, {
    username, email, name: tag.toUpperCase(), password: "secret123!", passwordConfirm: "secret123!",
  });
  check(`register ${tag}`, r.status === 200, r.json);
  await new Promise((r) => setTimeout(r, 3100));
  const login = await req("POST", "/api/collections/users/auth-with-password", null, { identity: username, password: "secret123!" });
  check(`login ${tag} by username`, login.status === 200, login.json);
  return { id: r.json.id, username, token: login.json?.token };
}

const A = await makeUser("ana");
const B = await makeUser("bob");
const C = await makeUser("cid");

// bad username
let r = await req("POST", "/api/collections/users/records", null, { username: "Bad Name", email: `x${suffix}@e.test`, password: "secret123!", passwordConfirm: "secret123!" });
check("reject invalid username", r.status === 400);
r = await req("POST", "/api/collections/users/records", null, { username: A.username, email: `y${suffix}@e.test`, password: "secret123!", passwordConfirm: "secret123!" });
check("reject duplicate username", r.status === 400);

// user lookup
r = await req("GET", `/api/collections/users/records?filter=${encodeURIComponent(`username="${B.username}"`)}`, C.token);
check("C can find B by username", r.json?.items?.length === 1, r.json);
check("email hidden from others", r.json?.items?.[0]?.email === "" || r.json?.items?.[0]?.email === undefined, r.json?.items?.[0]);
r = await req("GET", `/api/collections/users/records`, null);
check("guests cannot list users", (r.json?.items?.length ?? 0) === 0, r.json);

// games
r = await req("POST", "/api/collections/games/records", A.token, { name: "Catan", owner: A.id, config: { mode: "points" } });
check("A creates game", r.status === 200, r.json);
const G = r.json.id;
r = await req("POST", "/api/collections/games/records", B.token, { name: "Spoof", owner: A.id });
check("B cannot create game owned by A", r.status >= 400, r.json);
r = await req("GET", `/api/collections/games/records/${G}`, B.token);
check("B cannot see A's unplayed game", r.status === 404, r.json);

// sessions
r = await req("POST", "/api/collections/sessions/records", A.token, {
  game: G, created_by: A.id, players: [A.id, B.id], played_at: new Date().toISOString(), data: { v: 1 }, results: [],
});
check("A creates session with B", r.status === 200, r.json);
const S = r.json.id;
r = await req("POST", "/api/collections/sessions/records", B.token, { game: G, created_by: A.id, players: [B.id], played_at: new Date().toISOString() });
check("B cannot create session as A", r.status >= 400, r.json);

r = await req("GET", `/api/collections/sessions/records/${S}`, B.token);
check("B (participant) sees session", r.status === 200, r.json);
r = await req("GET", `/api/collections/sessions/records/${S}`, C.token);
check("C cannot see session", r.status === 404, r.json);
r = await req("GET", `/api/collections/games/records/${G}`, B.token);
check("B now sees the game", r.status === 200, r.json);
r = await req("GET", `/api/collections/games/records`, B.token);
check("B lists the game", r.json?.items?.some((g) => g.id === G), r.json);
r = await req("GET", `/api/collections/games/records`, C.token);
check("C lists no games", r.json?.items?.length === 0, r.json);

r = await req("PATCH", `/api/collections/sessions/records/${S}`, B.token, { notes: "edited by bob" });
check("B (participant) can edit", r.status === 200, r.json);
r = await req("PATCH", `/api/collections/sessions/records/${S}`, B.token, { created_by: B.id });
check("B cannot take ownership", r.status >= 400, r.json);
r = await req("PATCH", `/api/collections/sessions/records/${S}`, C.token, { notes: "hack" });
check("C cannot edit", r.status === 404, r.json);
r = await req("DELETE", `/api/collections/sessions/records/${S}`, B.token);
check("B cannot delete A's session", r.status >= 400, r.json);
r = await req("PATCH", `/api/collections/games/records/${G}`, B.token, { name: "Hacked" });
check("B cannot edit A's game", r.status >= 400, r.json);

// B logs own session of A's game -> A cannot delete the game anymore
r = await req("POST", "/api/collections/sessions/records", B.token, { game: G, created_by: B.id, players: [B.id], played_at: new Date().toISOString() });
check("B logs own session of A's game", r.status === 200, r.json);
const SB = r.json.id;
r = await req("DELETE", `/api/collections/games/records/${G}`, A.token);
check("A cannot delete game with B's sessions", r.status >= 400, r.json);
r = await req("DELETE", `/api/collections/sessions/records/${SB}`, B.token);
check("B deletes own session", r.status === 204, r.json);

// friends
r = await req("POST", "/api/collections/friends/records", A.token, { owner: A.id, friend: B.id });
check("A adds B as friend", r.status === 200, r.json);
r = await req("POST", "/api/collections/friends/records", A.token, { owner: A.id, friend: B.id });
check("no duplicate friend", r.status === 400, r.json);
r = await req("POST", "/api/collections/friends/records", A.token, { owner: A.id, friend: A.id });
check("cannot friend yourself", r.status >= 400, r.json);
r = await req("POST", "/api/collections/friends/records", C.token, { owner: A.id, friend: C.id });
check("C cannot add to A's list", r.status >= 400, r.json);
r = await req("GET", `/api/collections/friends/records`, B.token);
check("B sees that A added them", r.json?.items?.length === 1, r.json);
r = await req("GET", `/api/collections/friends/records`, C.token);
check("C sees no friendships", r.json?.items?.length === 0, r.json);

// A can now delete the game (only own sessions left) -> cascades sessions
r = await req("DELETE", `/api/collections/games/records/${G}`, A.token);
check("A deletes game once all sessions are theirs", r.status === 204, r.json);
r = await req("GET", `/api/collections/sessions/records/${S}`, A.token);
check("session cascaded", r.status === 404, r.json);

// empty-sessions game delete
r = await req("POST", "/api/collections/games/records", A.token, { name: "Empty", owner: A.id });
r = await req("DELETE", `/api/collections/games/records/${r.json.id}`, A.token);
check("delete game with no sessions", r.status === 204, r.json);

console.log(failures ? `\n${failures} FAILURES` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
