# Fauke — Development TODO

## MVP 1.0

### Infrastructure
- [x] Docker Compose (frontend + backend + postgres)
- [x] Vite + React + TypeScript frontend scaffold
- [x] Express + TypeScript backend scaffold
- [x] Prisma schema + migrations
- [x] Hot-reload in dev containers

### Backend API
- [x] `GET /api/projects` — list projects
- [x] `POST /api/projects` — create project
- [x] `PUT /api/projects/:id` — update project
- [x] `DELETE /api/projects/:id` — delete project
- [x] `GET /api/entries?from=&to=` — list entries in range
- [x] `POST /api/entries` — create entry
- [x] `PUT /api/entries/:id` — update entry
- [x] `DELETE /api/entries/:id` — delete entry
- [x] `GET /api/export/csv?from=&to=` — CSV download
- [x] `GET /api/export/pdf?from=&to=` — PDF download

### Frontend — Calendar View
- [x] Monthly calendar grid
- [x] Day cells show hours per project (color-coded chips)
- [x] Click day → slide-over / modal to add/edit entries
- [x] Navigate months (prev / next / today)
- [x] Total hours per week shown in sidebar or row

### Frontend — Table View
- [x] Spreadsheet-style grid: rows = days, columns = projects
- [x] Inline editable cells
- [x] Auto-sum row (daily total) and column (project total)
- [x] Date range picker to control visible rows

### Export
- [x] CSV export button (downloads file)
- [x] PDF export button (downloads styled report)
- [x] Date range selector for export scope

### Design / UX
- [x] Tailwind-based dark + light theme
- [x] Responsive layout (desktop-first, usable on tablet)
- [x] Smooth transitions between Calendar ↔ Table views
- [x] Toast notifications for save / delete / errors

---

## v1.5 — Integrations (Fortnox / Visma / PE Accounting)

### Database & Schema
- [x] `Integration` model (provider, name, JSON config, enabled flag)
- [x] `UserIntegration` model (user ↔ integration, external employee ID)
- [x] `SyncLog` model (integration sync history + status)
- [x] Prisma migration `add_integrations`

### Backend — Integration Service Layer
- [x] Adapter interface (`IntegrationAdapter`) with `testConnection` + `syncTimeEntries`
- [x] Adapter registry with provider metadata & config field schemas
- [x] Fortnox mock adapter (OAuth 2.0, POST /3/timereportings)
- [x] Visma mock adapter (OAuth 2.0, POST /v2/shortcuts/hoursworked + invoice drafts)
- [x] PE Accounting mock adapter (API token, POST /api/v1/company/{id}/timeregistration, XML)
- [x] Admin API: CRUD integrations (`/api/admin/integrations`)
- [x] Admin API: test connection (`POST /:id/test`)
- [x] Admin API: assign/remove users (`POST/DELETE /:id/users`)
- [x] Admin API: sync time entries (`POST /:id/sync`)
- [x] Admin API: view sync logs (`GET /:id/logs`)
- [x] Admin API: list providers with config schemas (`GET /providers`)

### Frontend — Admin Integrations Tab
- [x] Tabbed admin panel (Users | Integrations)
- [x] Integration list with provider badge, user count, sync count
- [x] Create integration modal (provider selector, config fields)
- [x] Expand/collapse detail view with config editing
- [x] Test connection button with inline result
- [x] Enable/disable toggle per integration
- [x] User assignment with external ID mapping
- [x] Sync modal (date range picker per user)
- [x] Sync log viewer (filterable by status)
- [x] Sensitive field masking with show/hide toggle

### Production Readiness (future)
- [x] Swap Fortnox mock → real adapter (requires Fortnox partner account)
- [x] Swap Visma mock → real adapter (requires Visma developer registration)
- [x] Swap PE Accounting mock → real adapter (requires customer API token)
- [x] OAuth callback flow for Fortnox & Visma (redirect + token exchange)
- [x] Encrypt integration config at rest (AES-256)
- [x] Scheduled auto-sync (cron-like, e.g. nightly)
- [x] Webhook receivers for real-time sync triggers
- [x] Per-integration rate limiting & retry with exponential backoff

---

## v2.0 — Plugin System
- [x] Define plugin interface (`IFaukePlugin`)
- [x] Plugin registry & config UI
- [x] Example: generic REST POST plugin
- [x] Example: webhook notification plugin
- [x] Example: CSV-upload plugin
- [x] Example: Jira Tempo plugin
- [x] Plugin execution log / history

## v3.0 — Multi-user (future)
- [x] Auth system (OAuth2 / magic link)
- [x] User settings page
- [x] Team / org support
- [x] Approval workflows
