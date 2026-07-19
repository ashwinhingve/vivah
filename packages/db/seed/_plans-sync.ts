// TEMPORARY runner — upserts ONLY the subscription plans, from the committed
// source of truth in @smartshaadi/types. Does not call seedFullDemo(), which
// creates demo users, profiles, matches and chats that must never reach
// production. Delete after use.
import { seedPlansOnly } from './full-demo.js';

seedPlansOnly()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error('plan sync failed:', e);
    process.exit(1);
  });
