# Daftaro

Daftaro is a planned Arabic-first financial companion for small and home-based businesses in Kuwait and the Gulf.

## Run & Operate

- `pnpm --filter @workspace/daftaro run dev` — run the Daftaro web app
- `pnpm --filter @workspace/daftaro run typecheck` — check the Daftaro app
- `pnpm --filter @workspace/daftaro run build` — build the static Next.js site
- `pnpm --filter @workspace/daftaro run test:money` — test exact product-cost arithmetic and formatting
- `pnpm --filter @workspace/daftaro run test:finance` — test financial totals, dashboard periods, margins, and money helpers
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- The Supabase connection check uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, stored in Replit Secrets.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Daftaro: Next.js App Router, React, TypeScript, Tailwind CSS
- The shared workspace includes an Express API server, PostgreSQL/Drizzle, and OpenAPI code generation; Daftaro currently uses Supabase directly for authentication, profiles, financial transactions, and products.

## Where things live

- `artifacts/daftaro/src/app/` — Next.js routes and metadata
- `artifacts/daftaro/src/App.tsx` — Arabic/English landing page content and interactions
- `artifacts/daftaro/src/index.css` — brand styling
- `artifacts/daftaro/src/app/auth/` — Supabase email/password signup (`/auth/signup`), sign-in, confirmation, and business-profile onboarding
- `artifacts/daftaro/src/app/dashboard/` — authenticated period-based finance dashboard and charts
- `artifacts/daftaro/src/app/transactions/` — authenticated income and expense ledger
- `artifacts/daftaro/src/app/products/` — authenticated product and per-unit cost management
- `artifacts/daftaro/src/lib/money.ts` — exact thousandth-unit product cost, profit, and margin calculations
- `artifacts/daftaro/src/lib/financial-summary.ts` — exact currency-separated transaction summaries
- `artifacts/daftaro/src/lib/dashboard-data.ts` — exact period comparisons, date ranges, trends, and expense categories
- `artifacts/daftaro/tests/` — regression checks for exact financial calculations and formatting
- `artifacts/daftaro/src/app/connection-test/` — temporary read-only Supabase connection check
- `artifacts/daftaro/supabase/migrations/` — versioned Supabase schema changes
- `lib/api-spec/openapi.yaml` — shared API contract, when a later approved phase needs backend routes

## Architecture decisions

- Work in the numbered phases from the product brief; finish one phase, explain how to try it, and wait for the user's approval before starting the next.
- The first phase is the landing page only. Do not add Supabase, a dashboard, authentication, OCR, or other internal features before approval.
- Keep financial arithmetic deterministic in code; AI may explain verified results but must not invent figures or modify records.
- Dashboard comparisons use the immediately preceding equal-length period; do not combine currencies without an explicit exchange rate.
- Authentication uses Supabase email/password with PKCE. Keep email confirmation enabled; users must be redirected only to allow-listed callback URLs.
- The auth completion page owns business-profile onboarding; `/dashboard` owns period-based KPIs and financial comparisons; `/transactions` owns income/expense records and the all-time currency-separated summary; `/products` owns product costs and per-unit profit/margin. Keep AI in its later approved phase.
- Implement billing with Stripe Test Mode only until the user explicitly approves live payments and account eligibility is confirmed.
- OCR is the final phase. The user selected OCR.Space's free tier; keep its key in Replit Secrets and server-side only, never store the original invoice file, and explain the free account/key setup step by step. Use the shared OpenAPI contract and regenerate clients after contract changes.

## Product

Daftaro helps small businesses record revenue and expenses, understand product costs and profit, and make better financial decisions. The bilingual landing page, Supabase authentication, business-profile onboarding, income/expense ledger, product-level unit costs/margins, all-time financial summary, and period-based dashboard are implemented; AI is not live yet.

## User preferences

- Explain API and service connection steps clearly when they arise.
- Prefer free plans and subscriptions whenever available.
- Use Arabic for guidance, with English technical terms where useful.

## Gotchas

- The Next.js site is statically exported for the artifact's production hosting; keep static export enabled unless hosting changes.
- Supabase Auth sign-up redirects to `/auth/callback`; add the current preview callback URL to Authentication > URL Configuration before testing email confirmation.
- Do not present planned product features as currently available or show fabricated financial data as real.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
