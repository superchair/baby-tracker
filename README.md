# Baby Tracker

A small, self-hosted web app for logging a baby's feedings and diaper
changes, built for a household of a few caregivers sharing one login. Log
in with Google (or any allow-listed account), tap a big button to log a
feeding or diaper change, browse history, and see basic stats — all from a
phone, installed as a PWA.

**Live app:** https://baby.brownserv.org

## Features

- One-tap logging: feeding (with quick-set 30/60/90ml buttons) and diaper
  changes, both with an editable time defaulting to "now"
- Dashboard shows a per-day feeding/diaper activity chart (defaults to
  today, pick any past day via the date picker)
- Filterable history (by type, date range, caregiver), with inline editing
- Stats: feedings per day, feeding volume (total + average per feeding),
  diaper changes per day
- Push notification reminders when it's been a while since the last
  feeding/diaper change
- Installable as a PWA on iOS/Android/desktop
- Auth0 login (Google or any allow-listed identity), no passwords to
  manage yourself

## Stack

- **Frontend** (`frontend/`) — React + TypeScript + Vite, Tailwind CSS,
  Recharts, `vite-plugin-pwa`. Deployed as a static site.
- **Backend** (`infra/`) — AWS CDK (TypeScript): API Gateway (HTTP API) +
  Lambda (Node.js), DynamoDB (single-table design), S3 + CloudFront for
  the frontend, EventBridge for scheduled reminder checks, Secrets
  Manager for push credentials. See [`infra/README.md`](infra/README.md)
  for the full architecture and deploy instructions.
- **Auth** — [Auth0](https://auth0.com), verified via a Lambda authorizer
  (JWKS, no shared secret needed).

## Local development

```bash
cd frontend
npm install
cp .env.local.example .env.local   # point VITE_API_URL at a deployed API
npm run dev
```

The frontend fetches `/config.json` at startup in production (written by
CDK at deploy time); `VITE_API_URL` is only used as a local-dev fallback
when that file isn't being served.

## Deploying

See [`infra/README.md`](infra/README.md) — covers the AWS profile/account
setup, building the frontend, `cdk deploy`, and the one-time secrets
bootstrap.

## Project layout

```
frontend/   React SPA
infra/      AWS CDK app (infrastructure + Lambda handlers)
```
