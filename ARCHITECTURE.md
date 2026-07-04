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
  - free-tier deploy: local ephemeral `storage/`
  - paid deploy option: move to a Render persistent disk or another persistent object storage target

## Runtime Flow

1. Browser loads the React app from the Render web service.
2. React calls same-origin backend routes under `/api`.
3. Express processes uploads, writes history to Supabase, and stores generated `.xlsx` files on the Render disk.
4. History UI reads from `clasp_scx_seamless.processing_records`.

## React Endpoints In Use

- `GET /api/bootstrap`
- `POST /api/workbooks/process`
- `GET /api/app/processing-records`
- `POST /api/app/processing-records/:id/mark-printed`
- `POST /api/app/processing-records/:id/mark-unprinted`
- `GET /api/files/:id/download`
- `GET /api/health`

No Google Apps Script UI is required for the preferred production path.

## Environment Variables

- `SC_OFFICIAL_SUPABASE_DATABASE_URL`: preferred database connection string for this repo on Render
- `SEAMLESS_DB_SCHEMA`: should stay `clasp_scx_seamless`
- `PUBLIC_BASE_URL`: external Render URL for file links
- `CORS_ORIGIN`: allowed browser origin if cross-origin access is needed
- `STORAGE_DIR`: `storage` on free-tier Render; use a persistent mount path only on paid plans
- `INTERNAL_API_TOKEN`: only needed for internal compatibility routes such as `/api/processing-records`

Backward-compatible aliases `DATABASE_URL` and `DB_SCHEMA` are still supported by the server, but the preferred names above match the shared-backend environment naming now in use.
