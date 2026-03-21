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

### `GET /stock-assets/:ticker`

Returns chart-ready quarterly price data for one ticker plus `IVV`, using one endpoint response.

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
