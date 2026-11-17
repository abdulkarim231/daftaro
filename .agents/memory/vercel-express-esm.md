---
name: Vercel Express ESM imports
description: Runtime module-resolution requirements for TypeScript Express APIs deployed through Vercel's Node ESM runtime.
---

Vercel can successfully build a TypeScript Express API while the deployed function still crashes if emitted ESM imports a directory or an extensionless local module. Use explicit `.ts` source specifiers with `rewriteRelativeImportExtensions` so emitted JavaScript points to `.js` files. Workspace packages exported as TypeScript source also need Node-compatible explicit imports; expose type-only modules with `export type *` so they are not loaded at runtime.

**Why:** Vercel's build check does not guarantee Node can resolve the emitted module graph when the function starts.

**How to apply:** For Vercel Express projects, test-import the emitted app entry and make an HTTP request to its health route before pushing; then check the deployed health endpoint after Vercel finishes.
