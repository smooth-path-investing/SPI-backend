# SPI Backend API Notes

This file documents the current backend API contract.

Whenever the API changes, update this file in the same change.

## Local Run

Install dependencies:

```bash
npm install
```

Start the server:

```bash
npm run dev
```

Default local base URL:

```text
http://127.0.0.1:3000
```

## Environment Variables

The backend expects these values in `.env`:

```text
PORT
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_ANON_KEY
```

## Active Endpoints

### `GET /health`

Health check.

Example response:

```json
{
  "status": "ok"
}
```

### `GET /stock-assets/tickers`

Returns the unique tickers available in `stock_assets`.

Example response:

```json
{
  "tickers": ["A", "AAPL", "ABT"],
  "count": 3
}
```

### `GET /stock-assets/:ticker/pricechart`

Returns chart-ready quarterly price data for one ticker.

Example:

```text
GET /stock-assets/AAPL/pricechart
```

Example response:

```json
{
  "ticker": "AAPL",
  "interval": "quarterly",
  "as_of": "2025-09-30",
  "points": [
    {
      "date": "2009-06-30",
      "close": 4.272,
      "benchmark_close": 68.307
    }
  ]
}
```
