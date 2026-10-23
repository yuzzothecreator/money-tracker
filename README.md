# MoneyFlow

A mobile-first personal finance PWA for Tanzania, built with Next.js App Router, strict TypeScript, React, Dexie, Recharts, Lucide, Zod and Supabase. Starts with **no financial sample data**. Dashboard values come from stored accounts and posted transactions.

## Run

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. For a production build, run `npm run build` and `npm start`. Use HTTPS outside localhost to enable service workers and installation. Android Chrome/Edge: browser menu → Install app / Add to Home screen.

Use the EN / SW buttons or Settings → Language / Lugha to switch between English and Kiswahili. The language choice is remembered on this browser. Switching languages translates interface labels while preserving account names, transaction descriptions and stored category/type values.

## Project structure

- `app/page.tsx`: responsive workspace, onboarding help, accounts, ledger entry/history/details, budgets, goals, debt repayments, schedules, calendar, reports, CSV, notifications, settings and backups.
- `app/cloud-sync.tsx`: authenticated cloud sync with revision conflicts, retry IDs and explicit cloud-copy review.
- `app/api/workspace/route.ts`: authenticated, validated, non-cacheable cloud endpoint.
- `lib/finance.ts`: integer money, accounting, reports, dates, debt principal, recurrence and CSV utilities.
- `lib/store.ts`: IndexedDB storage.
- `lib/validation.ts`: strict cloud/backup input validation.
- `supabase/001_finance.sql`: versioned schema, row security, append-only ledger corrections, RPC authorization and atomic saves.
- `public/`: service worker, manifest and install icons.
- `tests/`: accounting and embedded PostgreSQL integration tests.
- `e2e/`: real Edge browser workflows, persistence, offline reload, mobile and API authorization tests.

## Accounting model

Amounts are safe integers in whole currency units, capped at 900 billion per entry. TZS is the reporting currency. Accounts in KES, USD, EUR and GBP can be tracked separately in whole units; fractional foreign currency and FX conversion are not implemented. Unlike currencies are never added to the TZS dashboard total. Cross-currency transfers are rejected by both application logic and PostgreSQL.

Balances equal opening balance plus posted movements. Income, refunds, borrowing and positive adjustments add cash. Expenses and lending remove cash. Transfers and savings moves debit a source and credit a destination once. They do not count as consumption or income. Pending and cancelled records do not affect balances or reports. Refunds reduce reported expenses. Loan principal is excluded from income/expenses. Linked debt repayments reduce outstanding principal by total minus interest; interest is separately reported as income for receivables or expense for payables. Record the loan issuance separately from the debt agreement to avoid inventing a cash movement.

Budgets have explicit inclusive start/end dates, allowing weekly, monthly and custom periods. Savings goals derive progress from net savings moves into a dedicated linked TZS account; a second goal cannot use the same account. Recurring rules are **plans**, not proof of payment. Recording a posted scheduled payment advances its due date, clamps month ends, and prevents a duplicate occurrence. Reports distinguish cash flow from a limited net financial position: account assets plus recorded receivables minus recorded payables. It is not a complete valuation of all personal assets.

## Persistence, synchronization and conflicts

The default is **local first**. Changes are written atomically to IndexedDB before the UI reports success. Device records have stable UUIDs. A revision check prevents a stale tab from overwriting a newer local workspace. When a tab reports a conflict, reload before entering the change again. Local storage is not encrypted; use a trusted device and export backups.

Optional Supabase synchronization uses one account-owned workspace with normalized accounts, transactions, categories and planning records. All financial records in a synchronization commit are applied in one PostgreSQL transaction. Existing ledger movements receive inverse correction entries before the current projection is posted; ledger history is retained. An exclusive workspace-row lock and expected revision protect concurrent uploads. Mutation UUIDs make retries idempotent. HTTP 409 requires cloud-copy review/load, never an automatic overwrite. Review downloads a JSON backup without changing local records. Initial uploads will not overwrite an existing remote workspace without first loading it. Auto-sync is opt-in for the active browser session, retries on reconnection, and stops on an error. It does not run after the app closes.

The service worker caches the public application shell and static assets only. It does not cache authenticated financial APIs. Financial records stay in IndexedDB; a successful cloud sync is separately indicated. Browser storage eviction remains possible, so keep backups.

## Supabase setup

1. Create a Supabase project. Execute `supabase/001_finance.sql` once using the SQL editor or your migration tooling.
2. Copy `.env.example` to `.env.local`. Add the project URL and **public anonymous/publishable key**. Never add a service-role key to client code.
3. Configure Supabase Auth site URL and allowed redirect URLs for localhost and your deployment. Enable email confirmation, configure SMTP and rate limits for production.
4. Restart Next.js. Settings → Sign in / register; then Storage & backup → upload or load your workspace. Local records are not silently uploaded.
5. Each cloud request verifies the bearer token through Supabase Auth. RLS restricts reads to `auth.uid()`. Direct table writes are denied; the ownership-checking RPC performs atomic mutations. No client-supplied user ID is trusted.

Local mode is intentionally available without authentication. Signing out of Supabase **does not erase local records**. This is a single personal device workspace, not a shared-device multi-user application. Use backups and a separate browser profile for different people. The database's multiple cloud users are isolated, but there is no in-app local profile switcher.

## Backup and recovery

Storage & backup → Export full backup downloads JSON containing all local accounts, transactions, plans, categories and local audit history. Protect exported financial files. Restore validates the schema and account references before replacing local data, with confirmation. CSV export provides filtered transactions; CSV import provides column mapping, preview, validation and duplicate detection. Transfers with linked destinations must be entered manually rather than imported ambiguously. Duplicate detection is based on date/type/account/amount/normalized party; two legitimate identical transactions may need manual entry.

Enable Supabase managed backups/PITR according to your plan. Test restoring a database backup into a separate project. Never point development tests at a production financial database. No banking credentials, mobile-money PINs or OTPs are requested. Provider accounts are explicitly manual.

## Verification

```sh
npm test
npm run typecheck
npm run build
# Start the server in another terminal first:
npx playwright test
```

Browser tests use installed Microsoft Edge (`channel: 'msedge'`). Change the channel if your CI uses Chromium. PostgreSQL tests run the actual migration in PGlite, with a minimal `auth.uid()` fixture and two separate user identities. They exercise RLS, foreign-owner IDs, unauthorized writes, idempotent retries, revision conflicts, auditable corrections, cross-currency rejection and transaction rollback. They do not replace staging tests against Supabase's live Auth service and infrastructure.

## Deployment

Deploy this repository as a Next.js project on Vercel. Configure the two public Supabase environment variables for the correct environment. Apply the database migration before enabling cloud sync. Use the deployment HTTPS URL as the Auth site URL and redirect allowlist entry. Do not publish `.env.local`. Verify registration/email confirmation, password recovery, sign-out, two-user isolation, cloud conflicts, backups and Android installation on staging before production release.

The local UI and production server can run without Supabase variables. A cloud request then returns 401 and the interface explains that cloud setup is required.

## Release status and remaining scope

This is a working local-first implementation and cloud foundation, **not the entire production-ready specification**. Before treating it as production financial software, finish and verify:

- Live Supabase registration/recovery/password-update verification, session protections and shared-device local data separation.
- Production Supabase integration tests, deployment, real Android PWA installation and storage-eviction behavior.
- Private receipt upload/storage policies and attachment UI (metadata table exists; uploads are not implemented).
- Transaction splits, subcategories, linked-original refunds, editable category rules, account reconciliation, full record-level before/after audit UI and transaction time-of-day.
- Debt interest schedules/write-offs, detailed per-goal allocation histories, budget rollover/threshold preferences and recommendations.
- Manually valued assets, full net-worth history, more comparative reports, quarterly dashboard shortcuts, configurable notifications, push/email infrastructure and optional provider integrations.
- Further accessibility review, production rate limiting/monitoring and a security review. The UI uses custom accessible HTML controls and CSS rather than shadcn/Tailwind; these have not been added solely as unused dependencies.

No provider integrations are connected. No financial data or analytics are fabricated. Cloud credentials, external approvals and deployment accounts are not bundled.
