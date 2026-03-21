# Fitbit Health Dashboard — Design Spec

**Date:** 2026-03-21
**Location:** hamer.cloud Personal section
**Status:** Draft

## Overview

Add a comprehensive health dashboard to the Personal section of hamer.cloud showing 30-day trends from Fitbit data. Data is fetched on a schedule (every 4 hours), cached in DynamoDB with 12-month retention, and served via the existing API Gateway at `api.hamer.cloud/fitbit`.

## Architecture

```
EventBridge (every 4h) ──► fitbit_fetch Lambda ──► Fitbit API
                                    │
                                    ├── writes daily summaries to DynamoDB (fitbitData)
                                    └── refreshes OAuth tokens in SSM on 401

hamer.cloud ──► api.hamer.cloud/fitbit ──► fitbit_api Lambda ──► DynamoDB ──► JSON
```

### Components

1. **Fitbit Fetch Lambda** (`fitbit_fetch.py`) — Scheduled via EventBridge every 4 hours
   - Fetches 6 metrics from Fitbit API using range endpoints (30-day batch)
   - Stores daily summaries in DynamoDB keyed by date
   - Refreshes OAuth tokens on 401, stores new tokens in SSM
   - Uses range endpoints (`/date/today/30d.json`) — 7 API calls per run, well within Fitbit's 150 req/hr limit
   - Timeout: 120 seconds (7 HTTP calls at 100-500ms each, plus DynamoDB writes)

2. **Fitbit API Lambda** (`fitbit_api.py`) — Serves cached data via API Gateway
   - Scans `fitbitData` table (max ~365 items, PAY_PER_REQUEST — acceptable)
   - Filters to last 30 days in code
   - Returns JSON payload with all 6 metrics sorted by date
   - Returns CORS headers: `Access-Control-Allow-Origin: https://hamer.cloud`, `Access-Control-Allow-Methods: GET, OPTIONS`, `Access-Control-Allow-Headers: Content-Type`

3. **DynamoDB Table** — New dedicated `fitbitData` table (NOT reusing `genericDataTable`)
   - Partition key: `date` (string, YYYY-MM-DD)
   - Billing: PAY_PER_REQUEST (on-demand)
   - TTL attribute: `ttl` (365 days from write time)
   - ~365 items max at steady state

4. **API Gateway** — Add OPTIONS method with mock integration on `/fitbit` for CORS preflight

5. **Frontend** (`assets/js/fitbit-dashboard.js`) — Chart.js charts in Personal section
   - Fetches from `api.hamer.cloud/fitbit` on page load
   - Renders 5 chart panels

## Data Model

Each DynamoDB item (all fields except `date`, `ttl`, `fetched_at` are optional/nullable):

```json
{
  "date": "2026-03-21",
  "steps": 9323,
  "distance": 7.68,
  "resting_hr": 67,
  "active_minutes_fairly": 12,
  "active_minutes_very": 75,
  "sleep_efficiency": 87,
  "sleep_deep_min": 116,
  "sleep_light_min": 260,
  "sleep_rem_min": 115,
  "sleep_wake_min": 74,
  "weight": 91.2,
  "hr_zones": {
    "out_of_range": {"minutes": 1437, "calories": 2533},
    "fat_burn": {"minutes": 3, "calories": 21},
    "cardio": {"minutes": 0, "calories": 0},
    "peak": {"minutes": 0, "calories": 0}
  },
  "ttl": 1805629252,
  "fetched_at": "2026-03-21T12:00:00Z"
}
```

**Notes:**
- `weight` is sparse — only present on days the user weighs in. Frontend uses `spanGaps: true` to interpolate between data points.
- `sleep_*` fields are sparse — only present on nights the watch is worn to bed. Frontend shows gaps.
- `resting_hr` is occasionally null (Fitbit doesn't always compute it). Frontend skips null days in the line chart.
- Total sleep duration is derived from sum of stage minutes (deep + light + REM + wake) — no redundant `sleep_duration_ms` field.

## Fitbit API Endpoints Used

All use 30-day range endpoints (7 calls per scheduled run):

| Metric | Endpoint |
|--------|----------|
| Steps | `/1/user/-/activities/steps/date/today/30d.json` |
| Resting HR + Zones | `/1/user/-/activities/heart/date/today/30d.json` |
| Active mins (fairly) | `/1/user/-/activities/minutesFairlyActive/date/today/30d.json` |
| Active mins (very) | `/1/user/-/activities/minutesVeryActive/date/today/30d.json` |
| Sleep | `/1.2/user/-/sleep/date/{start}/{end}.json` (30-day range) |
| Distance | `/1/user/-/activities/distance/date/today/30d.json` |
| Weight | `/1/user/-/body/weight/date/today/30d.json` |

**Rate limiting:** 7 calls per run, runs every 4 hours = 42 calls/day. Fitbit allows 150/hour. No backfill burst needed — range endpoints return 30 days in one call.

## Frontend Design

### Layout (in Personal section, after existing content)

```
┌─────────────────────────────────────────────┐
│ Health & Fitness                             │
│ Last updated: 21 Mar 2026, 8:00 PM          │
├──────────────────────┬──────────────────────┤
│ Steps (30d)          │ Resting HR (30d)     │
│ [bar chart]          │ [line chart]         │
│ Today: 9,323         │ Latest: 67 bpm      │
│ Avg: 6,794           │ Avg: 66 bpm         │
├──────────────────────┼──────────────────────┤
│ Active Minutes (30d) │ Sleep (30d)          │
│ [stacked bar]        │ [stacked bar]        │
│ fairly + very        │ deep/light/REM/wake  │
│ Today: 87 min        │ Last: 9h25m          │
├──────────────────────┴──────────────────────┤
│ Distance & Weight (30d)                     │
│ [dual-axis line chart]                      │
│ Distance: 7.7 km today | Weight: 91.2 kg   │
│ (weight uses spanGaps for sparse data)      │
└─────────────────────────────────────────────┘
```

### Chart.js Configuration

- Dark theme: background transparent, grid lines `rgba(255,255,255,0.1)`, text `rgba(255,255,255,0.7)`
- Color palette:
  - Steps: `#4FC3F7` (light blue)
  - Heart rate: `#EF5350` (red)
  - Active mins fairly: `#FFB74D` (orange), very: `#FF7043` (deep orange)
  - Sleep deep: `#5C6BC0` (indigo), light: `#7986CB`, REM: `#9FA8DA`, wake: `#E0E0E0`
  - Distance: `#66BB6A` (green)
  - Weight: `#AB47BC` (purple)
- Responsive, mobile-friendly
- Tooltips on hover
- Load Chart.js from CDN: `https://cdn.jsdelivr.net/npm/chart.js`

### Loading & Error States

- Show "Loading health data..." with a subtle pulse animation while fetching
- If API returns empty data or errors, show "Health data temporarily unavailable"
- If specific metrics are missing (e.g., no sleep data), show the chart with a "No data" message rather than hiding it

## Infrastructure Changes (Terraform)

All in `/Users/thomashamer/source/mytf/websites/`:

1. **New `fitbitData` DynamoDB table** (`ddb.tf`)
   - Partition key: `date` (S)
   - Billing: PAY_PER_REQUEST
   - TTL enabled on `ttl` attribute

2. **New EventBridge rule** (`fitbit.tf` or `apig_data_fitbit.tf`)
   - Schedule: `rate(4 hours)`
   - Target: `fitbit_fetch` lambda

3. **Two new lambdas** replacing `fitbit_lambda`:
   - `fitbit_fetch` — scheduled writer (SSM read/write + DDB write, timeout 120s)
   - `fitbit_api` — API Gateway reader (DDB read only, timeout 30s)

4. **API Gateway OPTIONS method** on `/fitbit` resource
   - Mock integration returning CORS headers
   - Required for browser preflight requests

5. **IAM** — separate least-privilege roles:
   - `fitbit_fetch_role`: SSM GetParameter/PutParameter + DDB PutItem on `fitbitData`
   - `fitbit_api_role`: DDB Scan on `fitbitData`

6. **Fix zip provisioner** — replace `apk add zip` with `zip` directly (pre-installed on Ubuntu runners and macOS)

## CSP Update

Add `https://cdn.jsdelivr.net` to `connect-src` in `secheader.py` if not already present (it's already in `script-src` and `frame-src`). Chart.js is loaded as a script, not a connect-src resource, so this may not be needed — verify during implementation.

## Token Refresh Strategy

The fetch lambda runs every 4 hours. On each run:
1. Read access token from SSM
2. Make API calls
3. If 401: read refresh token from SSM, call Fitbit token refresh endpoint, store new tokens in SSM, retry
4. If refresh also fails: log error, publish CloudWatch custom metric `FitbitTokenRefreshFailure`

**Monitoring (required):** Create a CloudWatch alarm on `FitbitTokenRefreshFailure` metric. Threshold: >= 1 in 24 hours. Action: SNS notification to email. A dead scheduler with expired tokens is not recoverable without re-authorization.

Since the lambda runs every 4 hours, refresh tokens stay alive indefinitely (Fitbit refresh tokens expire only after extended inactivity).

## Migration Path

1. Deploy new `fitbitData` table, `fitbit_fetch` lambda, EventBridge rule, and `fitbit_api` lambda via Terraform
2. Keep old `fitbit_lambda` in place temporarily (API Gateway still points to it)
3. Wait for first `fitbit_fetch` run to populate DynamoDB (or invoke manually)
4. Verify data in DynamoDB
5. Switch API Gateway `/fitbit` GET integration from old `fitbit_lambda` to new `fitbit_api`
6. Add frontend to `index.html`, deploy via GitHub Actions
7. Remove old `fitbit_lambda` after confirming everything works
8. `genericDataTable` GPS data is separate — leave as-is

## Security

- Fitbit tokens in SSM Parameter Store (existing pattern)
- API Gateway endpoint is public but read-only (health data is not sensitive for a personal site)
- No PII beyond what's already on the public site
- CORS restricted to `https://hamer.cloud` and `https://www.hamer.cloud`
- API lambda has read-only DynamoDB access (no write permissions)

## Out of Scope

- Fitbit webhook/subscription API (unnecessary complexity for a personal site)
- Real-time intraday heart rate (high API cost, minimal visual value)
- Floors (mostly zeros from the device)
- Calories (derivative of steps/activity)
- Historical backfill beyond 30 days (range endpoints only go back 30d; older data accumulates over time as the scheduler runs daily)
