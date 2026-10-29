# GTG sync worker

Run from this folder (`gtg-tracker/sync-worker`). Already done: `wrangler login`, `d1 create gtg-sync`.

```
# 1. create the table in the remote D1 database
npx wrangler d1 execute gtg-sync --remote --file=schema.sql

# 2. make a secret + your sync key (note both!)
node make-key.mjs

# 3. store the secret in Cloudflare (paste SYNC_SECRET when asked)
npx wrangler secret put SYNC_SECRET

# 4. deploy → prints https://gtg-sync.<you>.workers.dev
npx wrangler deploy
```

Then in GitHub → repo → Settings → Secrets and variables → Actions → **Variables**:
`VITE_SYNC_URL` = the workers.dev URL from step 4. Commit + push to `main`.

On each device: Settings → Sync → paste the sync key → Connect & sync.
Keep the key private; anyone with it can read/write your data.
Need another key later? `node make-key.mjs <SYNC_SECRET>` (all keys under one secret are separate accounts).
