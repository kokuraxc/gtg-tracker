// Usage:
//   node make-key.mjs                 → creates a NEW secret + your first sync key
//   node make-key.mjs <SYNC_SECRET>   → mints another sync key under an existing secret
import { createHmac, randomBytes } from 'node:crypto';

const secret = process.argv[2] ?? randomBytes(32).toString('base64url');
const id = randomBytes(16).toString('base64url');
const mac = createHmac('sha256', secret).update(id).digest().subarray(0, 16).toString('base64url');

if (!process.argv[2]) {
  console.log('SYNC_SECRET (paste into: npx wrangler secret put SYNC_SECRET):\n' + secret + '\n');
}
console.log('Your sync key (enter on each device in Settings → Sync):\n' + id + '.' + mac);
