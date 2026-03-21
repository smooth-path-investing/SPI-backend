import { supabase } from "../lib/supabase";

type StockAssetTickerRow = {
  ticker: string | null;
};

export type StockAssetRow = {
  id: number;
  ticker: string;
  quarter_end: string | null;
  date: string | null;
  ivv_price: number | null;
  stock_price: number | null;
};

export type StockAssetChartPoint = {
  date: string;
  close: number;
};

export type StockAssetChartSeries = {
  ticker: string;
  benchmark_ticker: "IVV";
  interval: "quarterly";
  as_of: string;
  ticker_points: StockAssetChartPoint[];
  ivv_points: StockAssetChartPoint[];
};

const PAGE_SIZE = 1000;

export async function getAllStockTickers(): Promise<string[]> {
  const uniqueTickers = new Set<string>();
  let start = 0;

  while (true) {
    const { data, error } = await supabase
      .from("stock_assets")
      .select("ticker")
      .range(start, start + PAGE_SIZE - 1)
      .returns<StockAssetTickerRow[]>();

    if (error) {
      throw new Error(
        `Failed to read tickers from stock_assets: ${error.message}`
      );
    }

    const rows = data ?? [];

    for (const row of rows) {
      const ticker = row.ticker?.trim();

      if (ticker) {
        uniqueTickers.add(ticker);
      }
    }

    if (rows.length < PAGE_SIZE) {
      break;
    }

    start += PAGE_SIZE;
  }

  return Array.from(uniqueTickers);
}

async function getStockAssetDataByTicker(ticker: string): Promise<StockAssetRow[]> {
  const normalizedTicker = ticker.trim().toUpperCase();
  let start = 0;
  const rows: StockAssetRow[] = [];

  while (true) {
    const { data, error } = await supabase
      .from("stock_assets")
      .select("*")
      .eq("ticker", normalizedTicker)
      .order("date", { ascending: true })
      .order("quarter_end", { ascending: true })
      .range(start, start + PAGE_SIZE - 1)
      .returns<StockAssetRow[]>();

    if (error) {
      throw new Error(
        `Failed to read stock asset data for ${normalizedTicker}: ${error.message}`
      );
    }

    const pageRows = data ?? [];
    rows.push(...pageRows);

    if (pageRows.length < PAGE_SIZE) {
      break;
    }

    start += PAGE_SIZE;
  }

  return rows;
}

export async function getStockAssetChartSeriesByTicker(
  ticker: string
): Promise<StockAssetChartSeries | null> {
  const normalizedTicker = ticker.trim().toUpperCase();
  const rows = await getStockAssetDataByTicker(normalizedTicker);

  const tickerPoints = rows
    .filter(
      (
        row
      ): row is StockAssetRow & {
        date: string;
        stock_price: number;
      } =>
        row.date !== null &&
        row.stock_price !== null
    )
    .map((row) => ({
      date: row.date,
      close: row.stock_price
    }));

  const ivvPoints = rows
    .filter(
      (
        row
      ): row is StockAssetRow & {
        date: string;
        ivv_price: number;
      } =>
        row.date !== null &&
        row.ivv_price !== null
    )
    .map((row) => ({
      date: row.date,
      close: row.ivv_price
    }));

  if (tickerPoints.length === 0) {
    return null;
  }

  const asOfCandidates = [
    tickerPoints[tickerPoints.length - 1]?.date,
    ivvPoints[ivvPoints.length - 1]?.date
  ].filter((date): date is string => Boolean(date));

  return {
    ticker: normalizedTicker,
    benchmark_ticker: "IVV",
    interval: "quarterly",
    as_of: asOfCandidates.sort().at(-1) ?? tickerPoints[tickerPoints.length - 1].date,
    ticker_points: tickerPoints,
    ivv_points: ivvPoints
  };
}
