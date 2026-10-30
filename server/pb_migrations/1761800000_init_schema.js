/// <reference path="../pb_data/types.d.ts" />

// Bragboard database schema.
//
//  users     – PocketBase auth collection + a unique `username`
//  games     – a game type ("Catan", "Whist") with its scoring config
//  sessions  – one played match: game, participants, raw score input, computed results
//  friends   – a user's personal list of other users (one-directional)
//
// Access rules in short:
//  - any signed-in user can look up other users (username, name; never email)
//  - a session is visible to its creator and to every linked participant
//  - a game is visible to its owner and to anyone who has a session of it
//  - only creators delete; creators and participants can edit a session

const SESSION_ACCESS = "created_by = @request.auth.id || players.id ?= @request.auth.id";

migrate(
  (app) => {
    // ---------------------------------------------------------------- users
    const users = app.findCollectionByNameOrId("users");

    users.fields.add(
      new TextField({
        name: "username",
        required: true,
        min: 3,
        max: 20,
        pattern: "^[a-z0-9_.]+$",
        presentable: true,
      }),
    );
    users.addIndex("idx_users_username", true, "username", "");

    users.listRule = '@request.auth.id != ""';
    users.viewRule = '@request.auth.id != ""';
    users.updateRule = "id = @request.auth.id";
    users.deleteRule = "id = @request.auth.id";
    users.passwordAuth.identityFields = ["email", "username"];
    app.save(users);

    // ---------------------------------------------------------------- games
    const games = new Collection({
      type: "base",
      name: "games",
      fields: [
        { type: "text", name: "name", required: true, max: 60, presentable: true },
        { type: "text", name: "emoji", max: 16 },
        { type: "text", name: "color", max: 9 },
        { type: "text", name: "description", max: 500 },
        { type: "json", name: "config", maxSize: 20000 },
        { type: "relation", name: "owner", collectionId: users.id, maxSelect: 1, cascadeDelete: false },
        { type: "autodate", name: "created", onCreate: true, onUpdate: false },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE INDEX idx_games_owner ON games (owner)"],
    });
    app.save(games);

    // ------------------------------------------------------------- sessions
    const sessions = new Collection({
      type: "base",
      name: "sessions",
      listRule: SESSION_ACCESS,
      viewRule: SESSION_ACCESS,
      createRule: '@request.auth.id != "" && @request.body.created_by = @request.auth.id',
      updateRule:
        "(" + SESSION_ACCESS + ") && (@request.body.created_by:isset = false || @request.body.created_by = created_by)",
      deleteRule: "created_by = @request.auth.id",
      fields: [
        { type: "relation", name: "game", collectionId: games.id, maxSelect: 1, required: true, cascadeDelete: true },
        { type: "relation", name: "created_by", collectionId: users.id, maxSelect: 1, cascadeDelete: false },
        // linked accounts only (guests live in `data.participants`)
        { type: "relation", name: "players", collectionId: users.id, maxSelect: 100, cascadeDelete: false },
        { type: "date", name: "played_at", required: true },
        { type: "number", name: "duration_min", min: 0, onlyInt: true },
        { type: "text", name: "notes", max: 2000 },
        // raw input: participants, teams, scores / rounds / categories / ranks …
        { type: "json", name: "data", maxSize: 500000 },
        // computed per-participant results: score, rank, won (used for stats)
        { type: "json", name: "results", maxSize: 100000 },
        { type: "autodate", name: "created", onCreate: true, onUpdate: false },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE INDEX idx_sessions_game ON sessions (game)",
        "CREATE INDEX idx_sessions_played_at ON sessions (played_at)",
        "CREATE INDEX idx_sessions_created_by ON sessions (created_by)",
      ],
    });
    app.save(sessions);

    // games rules reference sessions, so they are set once sessions exist
    const gameAccess =
      "owner = @request.auth.id || sessions_via_game.created_by ?= @request.auth.id || sessions_via_game.players.id ?= @request.auth.id";
    games.listRule = gameAccess;
    games.viewRule = gameAccess;
    games.createRule = '@request.auth.id != "" && @request.body.owner = @request.auth.id';
    games.updateRule =
      "owner = @request.auth.id && (@request.body.owner:isset = false || @request.body.owner = @request.auth.id)";
    // the owner can delete a game only while every session of it is their own
    games.deleteRule =
      'owner = @request.auth.id && (sessions_via_game.id = "" || sessions_via_game.created_by = @request.auth.id)';
    app.save(games);

    // -------------------------------------------------------------- friends
    const friends = new Collection({
      type: "base",
      name: "friends",
      listRule: "owner = @request.auth.id || friend = @request.auth.id",
      viewRule: "owner = @request.auth.id || friend = @request.auth.id",
      createRule:
        '@request.auth.id != "" && @request.body.owner = @request.auth.id && @request.body.friend != @request.auth.id',
      updateRule: null,
      deleteRule: "owner = @request.auth.id",
      fields: [
        { type: "relation", name: "owner", collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: true },
        { type: "relation", name: "friend", collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: true },
        { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      ],
      indexes: ["CREATE UNIQUE INDEX idx_friends_pair ON friends (owner, friend)"],
    });
    app.save(friends);

    // ------------------------------------------------------------- settings
    const settings = app.settings();
    settings.meta.appName = "Bragboard";
    settings.rateLimits.enabled = true;
    app.save(settings);
  },
  (app) => {
    for (const name of ["friends", "sessions", "games"]) {
      try {
        app.delete(app.findCollectionByNameOrId(name));
      } catch (_) {}
    }
    const users = app.findCollectionByNameOrId("users");
    users.passwordAuth.identityFields = ["email"];
    users.removeIndex("idx_users_username");
    users.fields.removeByName("username");
    users.listRule = "id = @request.auth.id";
    users.viewRule = "id = @request.auth.id";
    app.save(users);
  },
);
