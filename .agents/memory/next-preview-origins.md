---
name: Next.js preview origins
description: Replit preview host allowlisting for Next.js development HMR.
---

For Next.js dev servers on Replit, include the Replit preview hostname in `allowedDevOrigins`; allowing only `127.0.0.1` can leave the proxied preview host blocked from HMR.

**Why:** The preview loaded, but Next.js logged that its proxied `.replit.dev` origin was blocked, which can leave preview clients stale after code changes.

**How to apply:** Use the current `REPLIT_DEV_DOMAIN` in the dev-only `allowedDevOrigins` configuration rather than hardcoding a preview URL.
