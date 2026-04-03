import { supabase } from "../lib/supabase";

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

const PAGE_SIZE = 1000;
const STOCK_FUNDAMENTAL_TABLE = "stock_fundamental";
const REBASED_VARIABLES = ["marketcap", "ps1", "pb"] as const;

function roundToFourDecimals(value: number): number {
  return Number(value.toFixed(4));
}

async function getStockFundamentalRowsByTicker(
  ticker: string
): Promise<StockFundamentalRow[]> {
  const normalizedTicker = ticker.trim().toUpperCase();
  const rows: StockFundamentalRow[] = [];
  let start = 0;

  while (true) {
    const { data, error } = await supabase
      .from(STOCK_FUNDAMENTAL_TABLE)
      .select("variable, date, value")
      .eq("ticker", normalizedTicker)
      .in("variable", Array.from(REBASED_VARIABLES))
      .order("variable", { ascending: true })
      .order("date", { ascending: true })
      .range(start, start + PAGE_SIZE - 1)
      .returns<StockFundamentalRow[]>();

    if (error) {
      throw new Error(
        `Failed to read stock fundamentals for ${normalizedTicker}: ${error.message}`
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

export async function getStockFundamentalRebasedSeriesByTicker(
  ticker: string
): Promise<StockFundamentalRebasedResponse | null> {
  const normalizedTicker = ticker.trim().toUpperCase();
  const rows = await getStockFundamentalRowsByTicker(normalizedTicker);

  if (rows.length === 0) {
    return null;
  }

  const variableRowsMap = new Map<string, StockFundamentalRow[]>();

  for (const row of rows) {
    const variable = row.variable?.trim();

    if (!variable) {
      continue;
    }

    const variableRows = variableRowsMap.get(variable) ?? [];
    variableRows.push(row);
    variableRowsMap.set(variable, variableRows);
  }

  const series = Array.from(variableRowsMap.entries())
    .sort(([leftVariable], [rightVariable]) =>
      leftVariable.localeCompare(rightVariable)
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

      const baseValue = orderedRows[0].value;

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
}
