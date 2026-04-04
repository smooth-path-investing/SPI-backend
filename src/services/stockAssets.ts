import { env } from "../config/env";
import { TtlCache } from "../lib/cache";
import { supabase } from "../lib/supabase";
import { fetchAllPages, normalizeNullableText, normalizeTicker, uniqueSorted } from "./shared";

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

const STOCK_ASSETS_TABLE = "stock_assets";
const tickerCache = new TtlCache<string[]>(env.cacheTtlMs);
const chartSeriesCache = new TtlCache<StockAssetChartSeries | null>(env.cacheTtlMs);

export async function getAllStockTickers(): Promise<string[]> {
  return tickerCache.getOrLoad("all", async () => {
    const rows = await fetchAllPages<StockAssetTickerRow>(async (from, to) => {
      const { data, error } = await supabase
        .from(STOCK_ASSETS_TABLE)
        .select("ticker")
        .range(from, to)
        .returns<StockAssetTickerRow[]>();

      if (error) {
        throw new Error(
          `Failed to read tickers from ${STOCK_ASSETS_TABLE}: ${error.message}`
        );
      }

      return data ?? [];
    });

    return uniqueSorted(
      rows.flatMap((row) => {
        const ticker = normalizeNullableText(row.ticker)?.toUpperCase();
        return ticker ? [ticker] : [];
      })
    );
  });
}

async function getStockAssetDataByTicker(
  ticker: string
): Promise<StockAssetRow[]> {
  const normalizedTicker = normalizeTicker(ticker);

  return fetchAllPages<StockAssetRow>(async (from, to) => {
    const { data, error } = await supabase
      .from(STOCK_ASSETS_TABLE)
      .select("ticker, quarter_end, date, ivv_price, stock_price")
      .eq("ticker", normalizedTicker)
      .order("date", { ascending: true })
      .order("quarter_end", { ascending: true })
      .range(from, to)
      .returns<StockAssetRow[]>();

    if (error) {
      throw new Error(
        `Failed to read stock asset data for ${normalizedTicker}: ${error.message}`
      );
    }

    return data ?? [];
  });
}

export async function getStockAssetChartSeriesByTicker(
  ticker: string
): Promise<StockAssetChartSeries | null> {
  const normalizedTicker = normalizeTicker(ticker);

  return chartSeriesCache.getOrLoad(normalizedTicker, async () => {
    const rows = await getStockAssetDataByTicker(normalizedTicker);

    const tickerPoints = rows
      .filter(
        (
          row
        ): row is StockAssetRow & {
          date: string;
          stock_price: number;
        } => row.date !== null && row.stock_price !== null
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
        } => row.date !== null && row.ivv_price !== null
      )
      .map((row) => ({
        date: row.date,
        close: row.ivv_price
      }));

    if (tickerPoints.length === 0) {
      return null;
    }

    const latestTickerPoint = tickerPoints.at(-1);

    if (!latestTickerPoint) {
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
      as_of: asOfCandidates.sort().at(-1) ?? latestTickerPoint.date,
      ticker_points: tickerPoints,
      ivv_points: ivvPoints
    };
  });
}
