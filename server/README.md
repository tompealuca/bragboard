# Bragboard server

[PocketBase](https://pocketbase.io) 0.40.6 with the Bragboard schema.

- `pb_migrations/` database schema and API access rules, applied automatically on start
- `pb_hooks/` server-side JavaScript hooks (none needed yet)
- `tests/access-rules.mjs` checks who can see/edit what, against a running server
- `scripts/seed-demo.mjs` fills a local server with demo data

Local run: download the PocketBase 0.40.6 zip for your OS from the [releases page](https://github.com/pocketbase/pocketbase/releases/tag/v0.40.6), unzip `pocketbase` here, then:

```bash
./pocketbase serve
./pocketbase superuser upsert you@example.com YourAdminPassword
```

Production runs in Docker, see [../docs/DEPLOY_PI.md](../docs/DEPLOY_PI.md).
