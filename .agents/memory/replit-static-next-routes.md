---
name: Replit static Next routes
description: Production route rewrites for Next.js static exports in this Replit monorepo.
---

For Next.js static exports, the output contains route files such as `auth.html` and `transactions.html`. A catch-all production rewrite to `/index.html` makes extensionless routes render the landing page instead of their route; map each app route (with and without trailing slash) to its matching exported HTML file.

**Why:** On the public Daftaro deployment, `/auth` and `/transactions` both returned the landing page while their `.html` files served the correct pages.

**How to apply:** Before changing production rewrites, compare `artifact.toml` with the files under the static export directory and use validated artifact configuration updates. Keep the root route serving `index.html` and preserve query strings on routes such as shared reports.
