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

### `GET /stock-etf/factors`

Returns the unique factor values from the `stock_etf.variable` column.

Example response:

```json
{
  "factors": ["DVY", "IWD", "MTUM"],
  "count": 3
}
```

### `GET /stock-factor-coefvec/:ticker/bar-graph`

Returns one normalized bar value per factor for the requested ticker.

This endpoint reads `stock_factor_coefvec` rows for the requested stock symbol,
sums every value inside each `coefficients` array, then normalizes each
factor-level total by the sum of absolute factor totals. Only the normalized
values are returned in the response.

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

Returns rebased time series for the requested ticker from `stock_fundamental`.

The endpoint currently rebases these variables:
- `marketcap`
- `ps1`
- `pb`

The database query only retrieves raw `variable`, `date`, and `value` rows for
the requested ticker. Each variable is then rebased in the backend so its
earliest available value becomes `100`. The `:ticker` path segment is dynamic,
so `AAPL` is just an example.

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
      "variable": "marketcap",
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
      "variable": "ps1",
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
