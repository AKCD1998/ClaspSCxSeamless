# ClaspSCxSeamless Architecture

## Scope

This repository is the document-processing system for the Seamless workflow. It is not the CRM/loyalty/POS stack.

The app shares a Supabase project with other systems, but this repo must stay isolated inside schema `clasp_scx_seamless`.

## Preferred Production Stack

- Frontend: React app from `client/`
- Backend: Express app from `server/`
- Deploy target: one Render web service serving both the React build and the `/api/*` routes
- Database: shared Supabase project `fneevjmjlgvjqcocknft`
- Database namespace for this repo: `clasp_scx_seamless`
- Generated file storage:
  - preferred: Cloudflare R2 (dedicated bucket/prefix for this repo), used automatically when `R2_*` env vars are set
  - fallback when R2 is not configured: local ephemeral `storage/` (fine for local dev; on free-tier Render this is wiped on every redeploy/restart)

## Runtime Flow

1. Browser loads the React app from the Render web service.
2. React calls same-origin backend routes under `/api`.
3. Express processes uploads, writes history to Supabase, and stores generated `.xlsx` files on the Render disk.
4. History UI reads from `clasp_scx_seamless.processing_records`.

## Authentication

The whole app (the React SPA and every `/api/*` route) sits behind `appAuth` middleware (`server/src/middleware/appAuth.js`), added after a post-launch security review found the app was otherwise reachable by anyone who knew the Render URL — including `POST /api/app/processing-records/:id/request-print`, which triggers a real print at the branch. `appAuth` accepts either credential:

- **HTTP Basic Auth** (`APP_BASIC_USER` / `APP_BASIC_PASSWORD`) — for humans using the web UI. Browsers show their own native login prompt and remember it, so no client-side code was needed.
- **Bearer `INTERNAL_API_TOKEN`** — the same token `print-agent/` already sends on every request, so the agent needed no changes.

Two paths are exempt (they can't carry our credentials): `GET /api/health` (Render health check) and `POST /api/line/webhook` (called by LINE's servers, protected instead by its own HMAC signature check — see below).

**Default-off in development:** if `APP_BASIC_USER` or `APP_BASIC_PASSWORD` is unset, `appAuth` lets every request through and logs a startup warning. **Both must be set in production (Render) or the app is wide open.**

## React Endpoints In Use

- `GET /api/bootstrap`
- `POST /api/workbooks/process`
- `GET /api/app/processing-records`
- `POST /api/app/processing-records/:id/mark-printed`
- `POST /api/app/processing-records/:id/mark-unprinted`
- `POST /api/app/processing-records/:id/request-print`
- `GET /api/files/:id/download`
- `POST /api/files/:id/send-email`
- `GET /api/health`

No Google Apps Script UI is required for the preferred production path.

## Auto-Print Agent + LINE Notify

Full design in `docs/09-auto-print-agent-design.md`; implementation checklist in `docs/10-print-agent-tasks.md`. A Node.js CLI (`print-agent/`) runs hourly on the branch machine ("000 HQ"), polls for unprinted documents, prints them via LibreOffice + SumatraPDF to the branch's Brother printer, and reports back so this backend can mark the record printed and notify a LINE group. The backend is the source of truth for all print job history — the agent itself only polls, prints, and reports.

Agent-only endpoints, all behind `internalApiAuth` (Bearer `INTERNAL_API_TOKEN`, same token shared with `print-agent/.env`):

- `GET /api/agent/print-queue` — documents due for auto-print (new upload since `AUTO_PRINT_SINCE`, or an admin-requested reprint), never returns a record another agent instance already claimed
- `POST /api/agent/print-jobs` — agent creates a job before it starts printing
- `PATCH /api/agent/print-jobs/:id` — agent reports status transitions (`downloading` → `sent_to_spooler` → `printing`/`failed`)
- `POST /api/agent/print-jobs/:id/complete` — marks the job `completed`, marks the processing record printed (`printedBy: 'auto-print-agent'`), and fires the LINE notification (a LINE failure never fails this endpoint)

LINE webhook (public, no `internalApiAuth` — protected instead by HMAC verification of `x-line-signature` against `LINE_CHANNEL_SECRET`):

- `POST /api/line/webhook` — used once during setup to capture the target group's `groupId` from an inbound event log; otherwise unused

## Environment Variables

- `SC_OFFICIAL_SUPABASE_DATABASE_URL`: preferred database connection string for this repo on Render
- `SEAMLESS_DB_SCHEMA`: should stay `clasp_scx_seamless`
- `PUBLIC_BASE_URL`: external Render URL for file links
- `CORS_ORIGIN`: allowed browser origin if cross-origin access is needed
- `STORAGE_DIR`: `storage` on free-tier Render; use a persistent mount path only on paid plans
- `INTERNAL_API_TOKEN`: gates `/api/processing-records` (internal compatibility routes) and `/api/agent/*` (auto-print agent) — must match `print-agent/.env`'s `INTERNAL_API_TOKEN`; also accepted app-wide as a Bearer credential by `appAuth` (see "Authentication" above)
- `APP_BASIC_USER`, `APP_BASIC_PASSWORD`: HTTP Basic Auth credentials for human access to the whole app via `appAuth`. **Required in production** — if either is unset, the app runs with no authentication at all (dev-only fallback, logs a startup warning)
- `AUTO_PRINT_SINCE`: ISO date; only processing records uploaded on/after this date are auto-printed by `print-agent/`. Empty disables auto-print entirely — a fail-safe until this is deliberately set for go-live (old documents still print via the "request-print" button)
- `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `LINE_TARGET_ID`: LINE Messaging API push notification config for the auto-print agent. If either the token or `LINE_TARGET_ID` is unset, notifications are silently skipped (recorded in `print_jobs.line_notify_error`) rather than failing the print flow
- `SENDGRID_API_KEY`, `MAIL_FROM`, `DOCS_RECIPIENT_EMAIL`: email delivery for `POST /api/files/:id/send-email`, same SendGrid provider already used by `currentSC-official-website-project/backend`
- `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_KEY_PREFIX`: Cloudflare R2 storage for generated files. Optional — when unset, files fall back to local disk. Downloads and email attachments are always proxied through this repo's own `/api/files/:id/*` routes, so the frontend and other consumers never need to know whether a file lives on R2 or local disk

Backward-compatible aliases `DATABASE_URL` and `DB_SCHEMA` are still supported by the server, but the preferred names above match the shared-backend environment naming now in use.
