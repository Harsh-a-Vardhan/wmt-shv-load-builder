# Walmart → SHV Logistics Load Builder

A small web app that automates the manual load-building workflow from the
Runbook case study:

1. **Fetch Loads** — pulls open freight tenders from the **Walmart Freight
   Tender API** (`GET /api/sap/loads`).
2. **Sanitize & Push** — transforms each raw tender into the format the **SHV
   SOR Integration API** requires, then pushes them (`POST /api/sor/loads`).

Both APIs authenticate with the account email as a bearer token. The email is
hardcoded as the default value of the on-screen input (`lib/config.js`), per the
assignment.

> Per Part 2, the Part 1 mode/weight **limits are disregarded** — the app
> fetches and loads **all** records; it does not filter any out.

## Sanitization rules

The Walmart tender format and the SHV SOR format disagree; the SOR rejects the
raw Walmart values, so `lib/sanitize.js` normalizes every field:

| SHV SOR field      | Walmart source | Transformation                                         |
| ------------------ | -------------- | ------------------------------------------------------ |
| `load_number`      | `load_no`      | pass-through (already `LD-` prefixed)                  |
| `bol_number`       | `frt_ord_no`   | pass-through (SAP freight order number)                |
| `shipper_name`     | `shipper_nm`   | trim, cap 200 chars                                    |
| `origin_city`      | `orig_city`    | trim                                                   |
| `origin_state`     | `orig_st`      | trim                                                   |
| `destination_city` | `dest_city`    | trim                                                   |
| `destination_state`| `dest_st`      | trim                                                   |
| `ship_date`        | `shp_dt`       | **MMDDYYYY → DDMMYYYY** (day/month flip)               |
| `delivery_date`    | `del_dt`       | **MMDDYYYY → DDMMYYYY**                                |
| `weight`           | `wgt`          | `"41,860 lbs"` → number `41860` (strip commas & units) |
| `equipment_type`   | `mode`         | temp-controlled → `Reefer 53'`, else `Dry Van 53'`     |

The three gotchas the SOR docs explicitly call out: **dates flip to day-first**,
**weight must be a bare JSON number**, and **equipment_type must be exactly**
`Reefer 53'` or `Dry Van 53'`.

## Architecture

- **Next.js 14 (App Router)** — deploys to Vercel with zero config.
- The two portal calls run in **server-side API routes**
  (`app/api/fetch-loads`, `app/api/push-loads`) so the browser never makes a
  cross-origin request (no CORS issues) and the bearer token is attached
  server-side.
- Loads are pushed in batches of ≤ 50 (the SOR's per-request cap).
- The UI shows the raw tenders, then the sanitized/SOR-ready loads, plus the
  accepted/rejected result from the SOR.

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000
```

## Deploy

Push to GitHub and import the repo in Vercel (or run `vercel`). No environment
variables required — the account email lives in `lib/config.js`.
