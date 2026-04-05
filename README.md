# Smooth Path Investing Backend Engineering Playbook

This is not just a setup note.

This file is the working handbook for engineers who build, review, debug, and deploy the Smooth Path Investing backend that serves the frontend experience. It explains how the service works, how we expect code to be written, how to collaborate safely, and which parts of the codebase are temporary versus production-ready.

If you are onboarding to the project, start with:

1. `System Overview`
2. `Quick Start`
3. `Project Structure`
4. `How We Write Code Here`
5. `Delivery Workflow`

## 1. System Overview

### What this service does

This backend is a small TypeScript HTTP API that:

- accepts read-only HTTP requests from the Smooth Path Investing frontend or local tools
- reads market and factor data from Supabase
- reshapes raw rows into frontend-friendly response formats
- exposes a narrow set of endpoints for health checks, ticker discovery, factor discovery, chart series, and rebased data

### High-level request flow

1. A client sends an HTTP request to the Node server.
2. The request is matched against a small route table.
3. Path inputs are decoded and validated.
4. A service function queries Supabase.
5. The backend transforms the raw rows into response-ready JSON.
6. The server returns the payload with security-oriented headers.

### Why this backend exists

The frontend should not need to understand the details of raw table structure, pagination, normalization rules, or rebasing logic. This backend centralizes that behavior so the frontend can stay focused on user experience and visualization.

### What this backend is not

This service is not currently:

- a full authentication service
- a general-purpose business rules engine
- a write-heavy API
- a background job runner
- a final production platform with comprehensive tests and observability

That distinction matters. Some parts are production-ready enough for a small deployment, while other parts are still intentionally lightweight.

## 2. Quick Start

### Prerequisites

- Node.js `22+`
- npm `10+`
- access to the correct Supabase project
- Docker Desktop or Docker Engine if you want containerized runs

### Local development run

This path runs the backend in `development` mode and reads from `.env.development`
plus any higher-priority local overrides.

Install dependencies:

```bash
npm install
```

Create or review your local development environment file:

```bash
cp .env.development.example .env.development
```

Start the app in watch mode:

```bash
npm run dev
```

The backend will be available at:

```text
http://127.0.0.1:3000
```

Health check:

```bash
curl http://127.0.0.1:3000/health
```

### Production-style local run

This path runs the backend in `production` mode and reads from `.env.production`
plus any higher-priority local overrides.

Build the project:

```bash
npm run build
```

Create or review your production environment file:

```bash
cp .env.production.example .env.production
```

Start the compiled server:

```bash
npm run start
```

### Local Docker run

The Docker profiles map to the same environments:

- `api-dev` uses the development target and `.env.development`
- `api-prod` uses the production target and `.env.production`

Development container:

```bash
docker compose --profile dev up --build api-dev
```

Production-style container:

```bash
docker compose --profile prod up --build api-prod
```

### Daily engineering checks

Before opening a PR, run:

```bash
npm run check
```

## 3. Environment Strategy

The repository supports two main runtime environments:

- local development
- production

### Development vs production at a glance

| Area | Development | Production |
| --- | --- | --- |
| Primary goal | local coding, testing, and frontend integration | deployed runtime behavior |
| Main command | `npm run dev` | `npm run start` |
| Docker profile | `api-dev` | `api-prod` |
| Main env file | `.env.development` | `.env.production` |
| Runtime style | watch mode with `ts-node` | compiled JavaScript from `dist/` |
| Error visibility | easier debugging during local work | safer client-facing errors |
| CORS expectation | localhost-friendly origins | explicit real frontend domain(s) |
| Cache default in examples | `60000` ms | `120000` ms |
| Typical credentials | non-production/local-safe credentials | deployed project credentials |
| Intended data safety level | experimentation and validation | stable user-facing operation |

### Which script uses which environment

| Command | Effective app environment | Expected env file |
| --- | --- | --- |
| `npm run dev` | `development` | `.env.development` |
| `npm run start` | `production` | `.env.production` |
| `npm run start:development` | `development` | `.env.development` |
| `npm run start:production` | `production` | `.env.production` |
| `docker compose --profile dev up --build api-dev` | `development` | `.env.development` |
| `docker compose --profile prod up --build api-prod` | `production` | `.env.production` |

### File loading order

The app bootstraps environment variables in this order:

1. `.env.{APP_ENV}.local`
2. `.env.local`
3. `.env.{APP_ENV}`
4. `.env`

Higher-priority files load first so their values win.

### Development environment

Use `.env.development` for:

- local testing
- local frontend integration
- Docker development runs
- safe experimentation

Typical development characteristics:

- watch mode enabled
- permissive local CORS list
- shorter cache TTL
- easier debugging
- fast feedback while changing backend code

What that means in practice:

- the server restarts automatically when code changes
- you can point the frontend at `localhost`
- debugging failures is easier because development is allowed to be more verbose
- this is the right environment for local feature work, refactors, and API iteration

### Production environment

Use `.env.production` for:

- deployed backend instances
- production CORS allowlists
- final host and port configuration
- production Supabase project credentials

Typical production characteristics:

- compiled build
- stricter operational settings
- explicit allowed frontend origins
- safer error exposure
- settings intended for deployed infrastructure

What that means in practice:

- the app runs the built output from `dist/`
- browser access should be limited to real approved frontend origins
- secrets should be production-only and never copied from development blindly
- this is the environment to validate before deployment and to use after deployment

### Concrete differences in this repo right now

These are the most important practical differences between the current example development and production envs:

- development allows localhost frontend origins such as `http://localhost:3000` and `http://localhost:5173`
- production expects a real deployed frontend origin such as `https://your-frontend-domain.com`
- development example cache TTL is `60000`
- production example cache TTL is `120000`
- development is meant for local testing with watch mode
- production is meant for compiled runtime behavior and deployment validation

### Required environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_ENV` | yes | selects `development`, `production`, or `test` |
| `PORT` | yes | HTTP port |
| `HOST` | yes | bind host, usually `0.0.0.0` |
| `SUPABASE_URL` | yes | Supabase project URL |
| `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY` | yes | Supabase client key |
| `CORS_ALLOWED_ORIGINS` | recommended | comma-separated allowed browser origins |
| `CACHE_TTL_MS` | optional | in-memory cache duration |
| `REQUEST_TIMEOUT_MS` | optional | Node request timeout |
| `HEADERS_TIMEOUT_MS` | optional | Node headers timeout |
| `KEEP_ALIVE_TIMEOUT_MS` | optional | Node keep-alive timeout |

### Environment rules

- Never commit real production secrets.
- Keep development and production credentials separate.
- Keep allowed origins explicit in production.
- Do not rely on `.env` alone for deployed environments.
- Use example files as templates, not as real secret stores.

## 4. API Contract

This backend currently exposes the following endpoints.

### `GET /health`

Purpose:

- confirms the server process is up

Example response:

```json
{
  "status": "ok"
}
```

### `GET /stock-assets/tickers`

Purpose:

- returns unique tickers from `stock_assets`

Example response:

```json
{
  "tickers": ["A", "AAPL", "ABT"],
  "count": 3
}
```

### `GET /stock-etf/factors`

Purpose:

- returns unique factor names from `stock_etf.variable`

Example response:

```json
{
  "factors": ["DVY", "IWD", "MTUM"],
  "count": 3
}
```

### `GET /stock-factor-coefvec/:ticker/bar-graph`

Purpose:

- returns one normalized factor bar per ticker

What the backend does:

- reads `stock_factor_coefvec` rows by `stock_symbol`
- parses coefficient collections
- sums the coefficients per factor
- normalizes each factor by the sum of absolute totals

Example:

```text
GET /stock-factor-coefvec/AAPL/bar-graph
```

Example response:

```json
{
  "ticker": "AAPL",
  "count": 3,
  "normalization_basis": "sum_of_absolute_total_coefficients",
  "bars": [
    {
      "factor_name": "USALUNR",
      "normalized_value": 0.42
    },
    {
      "factor_name": "EWI",
      "normalized_value": 0.33
    },
    {
      "factor_name": "MTUM",
      "normalized_value": -0.25
    }
  ]
}
```

### `GET /stock-fundamental/:ticker/rebased-series`

Purpose:

- returns rebased indicator series for the factors tied to the requested ticker

What the backend does:

- reads factor names for the ticker from `stock_factor_coefvec`
- routes each factor to the correct source table
- uses `stock_macro` when the factor starts with `USA`
- uses `stock_fundamental` when the factor name is lowercase
- uses `stock_etf` for other capitalized factor names
- uses the factor name without the leading `USA` as the lookup key for `stock_macro`
- fetches all matching time series in batches
- groups rows by factor name
- sorts each factor series by date
- rebases the first valid value to `100`
- rounds output values to four decimals

Notes:

- the route name is legacy naming, but the implementation now spans `stock_factor_coefvec`, `stock_macro`, `stock_fundamental`, and `stock_etf`
- the response shape stays the same, and each `series[].variable` value is now a factor name resolved from `stock_factor_coefvec`
- the response includes every factor returned by `stock_factor_coefvec`; if a factor has no matching source rows, its `series` array is empty

Example:

```text
GET /stock-fundamental/AAPL/rebased-series
```

Example response:

```json
{
  "ticker": "AAPL",
  "count": 3,
  "rebasing_basis": "first_value_per_variable_base_100",
  "series": [
    {
      "variable": "USALUNR",
      "series": [
        {
          "date": "2021-03-31",
          "value": 100
        },
        {
          "date": "2021-06-30",
          "value": 110.4321
        }
      ]
    },
    {
      "variable": "pb",
      "series": [
        {
          "date": "2021-03-31",
          "value": 100
        }
      ]
    },
    {
      "variable": "MTUM",
      "series": [
        {
          "date": "2021-03-31",
          "value": 100
        }
      ]
    }
  ]
}
```

### `GET /stock-assets/:ticker`

Purpose:

- returns chart-ready quarterly stock and IVV price series

What the backend does:

- reads rows from `stock_assets`
- extracts ticker close points
- extracts IVV benchmark points
- sets `as_of` to the latest available date

Example:

```text
GET /stock-assets/AAPL
```

Example response:

```json
{
  "ticker": "AAPL",
  "benchmark_ticker": "IVV",
  "interval": "quarterly",
  "as_of": "2025-09-30",
  "ticker_points": [
    {
      "date": "2009-06-30",
      "close": 4.272
    }
  ],
  "ivv_points": [
    {
      "date": "2009-06-30",
      "close": 68.307
    }
  ]
}
```

## 5. Project Structure

Current structure:

```text
src/
  bootstrap.ts
  index.ts
  config/
    env.ts
    loadEnv.ts
  http/
    errors.ts
    response.ts
  lib/
    cache.ts
    supabase.ts
  services/
    shared.ts
    stockAssets.ts
    stockEtf.ts
    stockFactorCoefvec.ts
    stockFundamental.ts
```

### What goes where

`src/bootstrap.ts`

- loads environment files
- registers process-level failure logging
- starts the server

`src/index.ts`

- owns route registration
- handles request orchestration
- maps service results into HTTP responses

`src/config/*`

- holds environment loading and validation logic

`src/http/*`

- holds HTTP-specific primitives such as errors and response helpers

`src/lib/*`

- holds reusable infrastructure utilities

`src/services/*`

- holds data access and transformation logic
- should not know about `ServerResponse`
- should stay reusable and testable

## 6. How the Code Works

### Boot process

1. `bootstrap.ts` determines the app environment.
2. It loads the correct env files.
3. It registers failure handlers.
4. It imports the server entry only after envs are loaded.
5. The server starts listening on the configured host and port.

### Request lifecycle

1. The request is parsed with a safe fallback origin.
2. CORS origin checks run before route work begins.
3. Only `GET` and `OPTIONS` are allowed.
4. Matching route handlers validate inputs.
5. Services fetch data from Supabase.
6. The response helper sends JSON with security headers.

### Caching

The backend now uses a small in-memory TTL cache for high-read data such as:

- ticker lists
- factor lists
- chart series
- rebased series
- factor bar graph responses

This improves repeated-read latency and reduces avoidable Supabase calls. It is intentionally simple and process-local.

Important caveat:

- this cache is not shared across replicas
- this cache is reset on restart
- this cache is useful for performance, not as a source of truth

## 7. How We Write Code Here

These are repository-level engineering rules, not suggestions.

### General coding principles

- Prefer clarity over cleverness.
- Make invalid states hard to represent.
- Validate external input early.
- Keep transformations near the data they transform.
- Fail fast on bad configuration.
- Keep HTTP concerns separate from data concerns.
- Make production behavior predictable.

### TypeScript expectations

- Use explicit types when they improve readability.
- Let inference work when the code is already obvious.
- Do not use `any` unless there is a strong, documented reason.
- Prefer narrow types over broad ones.
- Handle `null` and `undefined` deliberately.

### HTTP layer rules

- Route files should validate path and query input.
- Route handlers should call services, not embed database logic.
- Do not duplicate response-header logic across handlers.
- Return stable JSON shapes.
- Expose detailed internal errors only outside production.

### Service layer rules

- Services should be deterministic for the same inputs.
- Services should return domain data, not write directly to the response.
- Keep Supabase queries focused and explicit.
- Select only columns you need.
- Reuse pagination helpers instead of rewriting loops.
- Normalize external data carefully before transforming it.

### Configuration rules

- All config must flow through `src/config/env.ts`.
- Never read raw `process.env` values all over the codebase.
- If a new env variable is introduced, document it in this file and in the example env files.

### Error handling rules

- Use `HttpError` for expected request failures.
- Throw ordinary `Error` objects for infrastructure failures.
- Never swallow database errors silently.
- Never return stack traces to production clients.

### Security rules

- Never trust path parameters without validation.
- Do not use request host headers to build routing URLs.
- Keep CORS explicit.
- Avoid sending permissive browser headers by default.
- Do not persist Supabase auth state in a server-only process.
- Keep secrets out of tracked files.

### Performance rules

- Avoid `select("*")` unless the full row is truly required.
- Cache read-heavy stable responses when safe.
- Reuse helpers for pagination and normalization.
- Keep response payloads as small as practical.

## 8. Naming Conventions

### Files

- use `camelCase.ts` for service and utility modules
- use names that describe behavior, not vague categories

Good examples:

- `stockFundamental.ts`
- `loadEnv.ts`
- `response.ts`

Bad examples:

- `helpers.ts`
- `misc.ts`
- `temp.ts`

### Functions

- use verbs for operations
- use `get`, `load`, `build`, `normalize`, `parse`, `resolve`, `send`, `start`

Good examples:

- `getStockAssetChartSeriesByTicker`
- `resolveAppEnvironment`
- `sendJson`

### Variables

- be specific and domain-aware
- prefer `normalizedTicker` over `value2`
- prefer `requestUrl` over `u`

## 9. Delivery Workflow

### Branching

Recommended branch style:

```text
codex/<short-description>
feature/<short-description>
fix/<short-description>
```

Examples:

```text
codex/backend-hardening
feature/add-docker-runtime
fix/validate-ticker-input
```

### Commit style

Keep commits focused. A good commit usually does one thing:

- add runtime hardening
- refactor a service
- add container support
- rewrite developer handbook

Good commit examples:

- `refactor backend request handling and env loading`
- `add docker and compose support for dev and prod`
- `rewrite readme as engineering playbook`

### Pull request expectations

A strong PR should include:

- a short problem statement
- what changed
- how it was verified
- any environment changes
- any risks or follow-ups

### PR review checklist

- Is the behavior correct?
- Are inputs validated?
- Are errors handled intentionally?
- Are types precise enough?
- Is the change easy to understand six months from now?
- Is the documentation updated?

## 10. Frontend Collaboration Guidance

This backend exists to support the Smooth Path Investing frontend, so backend changes should be easy for frontend engineers to consume.

### When changing an endpoint

- keep response keys stable whenever possible
- document shape changes in this file
- note whether the change is additive or breaking
- tell frontend engineers whether caching behavior changed

### When adding an endpoint

- define the consumer clearly
- return a frontend-friendly structure
- avoid leaking raw database weirdness into the API contract
- give the endpoint one clear responsibility

### When a backend change is likely to break the frontend

- call it out early
- provide a sample response
- include migration notes in the PR description

## 11. Temporary vs Production-Ready

### Production-ready enough today

- environment validation
- safer route handling
- request method restrictions
- security headers
- explicit CORS allowlist support
- graceful shutdown
- multi-stage Docker build
- Docker Compose dev and prod flows
- basic in-memory caching for read-heavy endpoints

### Temporary or lightweight by design

- no automated test suite beyond type and build checks
- no centralized structured logging stack
- no metrics, tracing, or alerting integration
- no authentication or authorization middleware
- no rate limiting
- no schema-level runtime validation library
- no CI pipeline configuration in this repository

### What to improve next for a stronger production baseline

- add automated API tests
- add request logging and correlation IDs
- add rate limiting
- add schema validation for responses and inputs
- add CI checks
- add observability hooks
- add deployment manifests if the hosting platform requires them

## 12. Docker and Deployment Notes

### Dockerfile strategy

The Dockerfile uses multiple stages:

- `deps` installs full dependencies
- `build` compiles the TypeScript app
- `prod-deps` installs production-only dependencies
- `development` runs watch mode
- `production` runs the compiled app as a non-root user

### Compose strategy

`docker-compose.yml` includes:

- `api-dev` for local development
- `api-prod` for production-like container validation

Each service has:

- a health check
- explicit env file usage
- predictable port mapping
- restart policy

### Deployment checklist

Before deploying:

1. Fill `.env.production` with real production values.
2. Set the production frontend origin in `CORS_ALLOWED_ORIGINS`.
3. Run `npm run check`.
4. Build the production container.
5. Confirm `/health` responds correctly.
6. Smoke-test the frontend against the deployed backend.

## 13. Onboarding Checklist

Use this when a new engineer joins the project.

### First 30 minutes

- install Node and dependencies
- read this file fully
- inspect `src/index.ts`
- inspect the service modules
- inspect env examples

### First 60 minutes

- run the backend locally
- hit `/health`
- hit one ticker endpoint
- trace the code path from route to Supabase query to response

### First day

- understand the purpose of every top-level source file
- learn how development and production envs differ
- review the collaboration rules in this handbook
- make one safe, small change and verify it locally

## 14. Troubleshooting

### The app fails on startup with missing env errors

Likely cause:

- required values are missing from `.env.development` or `.env.production`

What to do:

- compare your file against the example env files
- verify `SUPABASE_URL`
- verify one of `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY`

### Browser requests fail with CORS errors

Likely cause:

- frontend origin is not included in `CORS_ALLOWED_ORIGINS`

What to do:

- add the exact frontend origin
- restart the backend

### Docker Compose fails because an env file is missing

Likely cause:

- `.env.development` or `.env.production` does not exist

What to do:

- copy the matching example file
- fill in real values

### A route returns `404` for a valid-looking ticker

Likely cause:

- the ticker is not present in the underlying table
- the ticker contains characters outside the supported format

What to do:

- test `/stock-assets/tickers`
- confirm the exact symbol stored in Supabase

## 15. Definition of Done

A backend change is done when:

- the code is clear
- the change is verified locally
- the docs in this file are updated if behavior changed
- env changes are documented
- the frontend impact is understood
- the change is safe to maintain later

## 16. Final Notes

The current backend is intentionally small. That is a strength if we protect it from accidental complexity.

The standard for changes in this repo is simple:

- make the code easier to understand
- make the behavior safer
- keep the API predictable
- leave better guidance for the next engineer than the last engineer had
