# Fauke — Time Report Hub

## Vision

Consultants and professionals often work across multiple clients, projects, and organizations — each with their own time reporting system. Fauke is a single, sleek web app where you fill out your time report **once**, then export or sync it everywhere else.

## Problem

- Filling out the same hours in 2–5 different systems every week/month is tedious and error-prone.
- Existing tools are clunky, ugly, or locked into a single ecosystem.
- There's no simple "source of truth" for your own time data.

## Solution

A self-hosted, Docker-based web app with:

- **Calendar View** — Click a day, log your hours visually.
- **Table View** — Spreadsheet-style bulk entry for power users.
- **Export** — CSV and PDF export of any date range.
- **Plugin System** (v2.0) — Write simple plugins to push your data into external systems (Jira Tempo, Harvest, custom ERPs, etc.).

## Tech Stack

| Layer       | Technology                          |
| ----------- | ----------------------------------- |
| Frontend    | React 18 + TypeScript + Vite        |
| Styling     | Tailwind CSS 3                      |
| Backend     | Node.js + Express + TypeScript      |
| Database    | PostgreSQL 16                       |
| ORM         | Prisma                              |
| PDF Export  | @react-pdf/renderer (server-side)   |
| CSV Export  | json2csv                            |
| Containers  | Docker Compose                      |

## Architecture

```
┌─────────────────────────────────────────────┐
│                 Browser                     │
│  React SPA (Vite)                           │
│  ┌──────────────┐  ┌────────────────────┐   │
│  │ Calendar View │  │   Table View       │   │
│  └──────────────┘  └────────────────────┘   │
│     + Admin Panel (Integrations/Plugins)    │
└──────────────┬──────────────────────────────┘
               │ REST API (JSON)
┌──────────────▼──────────────────────────────┐
│           Express API Server                │
│  /api/auth  /api/projects  /api/entries     │
│  /api/export  /api/admin/*  /api/plugins    │
└──────────────┬──────────────────────────────┘
               │ Prisma ORM
┌──────────────▼──────────────────────────────┐
│           PostgreSQL 16                     │
│  tables: projects, time_entries             │
└─────────────────────────────────────────────┘
```

## Data Model (core)

**Project**
- `id` (UUID)
- `name`
- `color` (hex, for calendar chips)
- `createdAt` / `updatedAt`

**TimeEntry**
- `id` (UUID)
- `projectId` → Project
- `date` (DATE)
- `hours` (DECIMAL)
- `note` (TEXT, optional)
- `createdAt` / `updatedAt`

## Versioning Roadmap

### v1.0 — MVP
- [x] Project setup with Docker Compose
- [x] Calendar view (click day → add entry)
- [x] Table view (spreadsheet-like editing)
- [x] CRUD for projects & time entries
- [x] CSV export
- [x] PDF export
- [x] Basic auth (single-user)

### v2.0 — Plugin System
- [x] Plugin API: define sync targets in JS/TS modules
- [x] Built-in plugin UI to configure & trigger syncs
- [x] Example plugin: generic REST POST
- [x] Webhook notification plugin support
- [ ] Example plugins: CSV upload, Jira Tempo

### v3.0 — Multi-user & Teams
- [ ] User accounts & auth (OAuth / magic link)
- [ ] Team dashboards & manager approval flows
- [ ] Shared project library
