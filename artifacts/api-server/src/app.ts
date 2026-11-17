import type { Express } from "express";
// The build script creates this bundled app before Vercel compiles this entry.
// @ts-ignore - the generated bundle intentionally has no TypeScript declarations.
import app from "../dist/index.mjs";

export default app as Express;
