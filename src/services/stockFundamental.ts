import { env } from "../config/env";
import { TtlCache } from "../lib/cache";
import { supabase } from "../lib/supabase";
import { fetchAllPages, normalizeNullableText, normalizeTicker } from "./shared";

type StockFundamentalRow = {
  variable: string | null;
  date: string | null;
  value: number | null;
};

export type StockFundamentalSeriesPoint = {
  date: string;
  value: number;
};

export type StockFundamentalSeries = {
  variable: string;
  series: StockFundamentalSeriesPoint[];
};

export type StockFundamentalRebasedResponse = {
  ticker: string;
  count: number;
  rebasing_basis: "first_value_per_variable_base_100";
  series: StockFundamentalSeries[];
};

const STOCK_FUNDAMENTAL_TABLE = "stock_fundamental";
const REBASED_VARIABLES = ["marketcap", "ps1", "pb"] as const;
type RebasedVariable = (typeof REBASED_VARIABLES)[number];
const VARIABLE_ORDER = new Map(
  REBASED_VARIABLES.map((variable, index) => [variable, index] as const)
);
const rebasedSeriesCache = new TtlCache<StockFundamentalRebasedResponse | null>(
  env.cacheTtlMs
);

function roundToFourDecimals(value: number): number {
  return Number(value.toFixed(4));
}

function isRebasedVariable(value: string): value is RebasedVariable {
  return REBASED_VARIABLES.includes(value as RebasedVariable);
}

async function getStockFundamentalRowsByTicker(
  ticker: string
): Promise<StockFundamentalRow[]> {
  const normalizedTicker = normalizeTicker(ticker);

  return fetchAllPages<StockFundamentalRow>(async (from, to) => {
    const { data, error } = await supabase
      .from(STOCK_FUNDAMENTAL_TABLE)
      .select("variable, date, value")
      .eq("ticker", normalizedTicker)
      .in("variable", Array.from(REBASED_VARIABLES))
      .order("variable", { ascending: true })
      .order("date", { ascending: true })
      .range(from, to)
      .returns<StockFundamentalRow[]>();

    if (error) {
      throw new Error(
        `Failed to read stock fundamentals for ${normalizedTicker}: ${error.message}`
      );
    }

    return data ?? [];
  });
}

export async function getStockFundamentalRebasedSeriesByTicker(
  ticker: string
): Promise<StockFundamentalRebasedResponse | null> {
  const normalizedTicker = normalizeTicker(ticker);

  return rebasedSeriesCache.getOrLoad(normalizedTicker, async () => {
    const rows = await getStockFundamentalRowsByTicker(normalizedTicker);

    if (rows.length === 0) {
      return null;
    }

    const variableRowsMap = new Map<RebasedVariable, StockFundamentalRow[]>();

    for (const row of rows) {
      const variable = normalizeNullableText(row.variable)?.toLowerCase();

      if (!variable || !isRebasedVariable(variable)) {
        continue;
      }

      const variableRows = variableRowsMap.get(variable) ?? [];
      variableRows.push(row);
      variableRowsMap.set(variable, variableRows);
    }

    const series = Array.from(variableRowsMap.entries())
      .sort(
        ([leftVariable], [rightVariable]) =>
          (VARIABLE_ORDER.get(leftVariable) ?? Number.MAX_SAFE_INTEGER) -
          (VARIABLE_ORDER.get(rightVariable) ?? Number.MAX_SAFE_INTEGER)
      )
      .flatMap(([variable, variableRows]) => {
        const orderedRows = variableRows
          .filter(
            (
              row
            ): row is StockFundamentalRow & {
              date: string;
              value: number;
            } =>
              row.date !== null &&
              row.value !== null &&
              !Number.isNaN(row.value)
          )
          .sort((leftRow, rightRow) => leftRow.date.localeCompare(rightRow.date));

        if (orderedRows.length === 0) {
          return [];
        }

        const firstRow = orderedRows[0];

        if (!firstRow) {
          return [];
        }

        const baseValue = firstRow.value;

        if (baseValue === 0) {
          return [];
        }

        return [
          {
            variable,
            series: orderedRows.map((row) => ({
              date: row.date,
              value: roundToFourDecimals((row.value / baseValue) * 100)
            }))
          }
        ];
      });

    if (series.length === 0) {
      return null;
    }

    return {
      ticker: normalizedTicker,
      count: series.length,
      rebasing_basis: "first_value_per_variable_base_100",
      series
    };
  });
}
