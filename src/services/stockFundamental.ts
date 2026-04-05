import { env } from "../config/env";
import { TtlCache } from "../lib/cache";
import { supabase } from "../lib/supabase";
import { getStockFactorNamesByTicker } from "./stockFactorCoefvec";
import { fetchAllPages, normalizeNullableText, normalizeTicker } from "./shared";

type StockIndicatorRow = {
  variable: string | null;
  date: string | null;
  value: number | null;
};

type SourceVariableMapping = {
  responseVariable: string;
  sourceVariables: string[];
};

type IndicatorSourceTable =
  | "stock_etf"
  | "stock_fundamental"
  | "stock_macro";

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

const STOCK_ETF_TABLE = "stock_etf";
const STOCK_FUNDAMENTAL_TABLE = "stock_fundamental";
const STOCK_MACRO_TABLE = "stock_macro";
const rebasedSeriesCache = new TtlCache<StockFundamentalRebasedResponse | null>(
  env.cacheTtlMs
);

function roundToFourDecimals(value: number): number {
  return Number(value.toFixed(4));
}

function resolveIndicatorSourceTable(
  factorName: string
): IndicatorSourceTable {
  if (factorName.startsWith("USA")) {
    return STOCK_MACRO_TABLE;
  }

  if (factorName === factorName.toLowerCase()) {
    return STOCK_FUNDAMENTAL_TABLE;
  }

  return STOCK_ETF_TABLE;
}

function buildSourceVariableMappings(
  factors: string[]
): Record<IndicatorSourceTable, SourceVariableMapping[]> {
  const groupedFactors: Record<IndicatorSourceTable, SourceVariableMapping[]> = {
    [STOCK_ETF_TABLE]: [],
    [STOCK_FUNDAMENTAL_TABLE]: [],
    [STOCK_MACRO_TABLE]: []
  };

  for (const factor of factors) {
    const table = resolveIndicatorSourceTable(factor);
    const sourceVariables = table === STOCK_MACRO_TABLE ? [factor.slice(3)] : [factor];

    groupedFactors[table].push({
      responseVariable: factor,
      sourceVariables
    });
  }

  return groupedFactors;
}

async function getIndicatorRowsFromTable(
  table: IndicatorSourceTable,
  mappings: SourceVariableMapping[],
  ticker?: string
): Promise<StockIndicatorRow[]> {
  if (mappings.length === 0) {
    return [];
  }

  const normalizedTicker = ticker ? normalizeTicker(ticker) : undefined;
  const sourceVariables = Array.from(
    new Set(
      mappings.flatMap((mapping) => mapping.sourceVariables)
    )
  );
  const responseVariableBySourceVariable = new Map<string, string>();

  for (const mapping of mappings) {
    for (const sourceVariable of mapping.sourceVariables) {
      responseVariableBySourceVariable.set(
        sourceVariable,
        mapping.responseVariable
      );
    }
  }

  return fetchAllPages<StockIndicatorRow>(async (from, to) => {
    const query = supabase
      .from(table)
      .select("variable, date, value")
      .in("variable", sourceVariables)
      .order("variable", { ascending: true })
      .order("date", { ascending: true })
      .range(from, to);

    const { data, error } =
      table === STOCK_FUNDAMENTAL_TABLE
        ? await query.eq("ticker", normalizedTicker).returns<StockIndicatorRow[]>()
        : await query.returns<StockIndicatorRow[]>();

    if (error) {
      throw new Error(
        `Failed to read indicator series from ${table}${
          normalizedTicker ? ` for ${normalizedTicker}` : ""
        }: ${error.message}`
      );
    }

    return (data ?? []).map((row) => {
      const normalizedVariable = normalizeNullableText(row.variable);
      const responseVariable = normalizedVariable
        ? responseVariableBySourceVariable.get(normalizedVariable) ?? normalizedVariable
        : row.variable;

      return {
        ...row,
        variable: responseVariable
      };
    });
  });
}

export async function getStockFundamentalRebasedSeriesByTicker(
  ticker: string
): Promise<StockFundamentalRebasedResponse | null> {
  const normalizedTicker = normalizeTicker(ticker);

  return rebasedSeriesCache.getOrLoad(normalizedTicker, async () => {
    const factorNames = await getStockFactorNamesByTicker(normalizedTicker);

    if (factorNames.length === 0) {
      return null;
    }

    const factorOrder = new Map(
      factorNames.map((factorName, index) => [factorName, index] as const)
    );
    const groupedFactors = buildSourceVariableMappings(factorNames);
    const [macroRows, fundamentalRows, etfRows] = await Promise.all([
      getIndicatorRowsFromTable(STOCK_MACRO_TABLE, groupedFactors[STOCK_MACRO_TABLE]),
      getIndicatorRowsFromTable(
        STOCK_FUNDAMENTAL_TABLE,
        groupedFactors[STOCK_FUNDAMENTAL_TABLE],
        normalizedTicker
      ),
      getIndicatorRowsFromTable(STOCK_ETF_TABLE, groupedFactors[STOCK_ETF_TABLE])
    ]);
    const rows = [...macroRows, ...fundamentalRows, ...etfRows];
    const variableRowsMap = new Map<string, StockIndicatorRow[]>();

    for (const row of rows) {
      const variable = normalizeNullableText(row.variable);

      if (!variable) {
        continue;
      }

      const variableRows = variableRowsMap.get(variable) ?? [];
      variableRows.push(row);
      variableRowsMap.set(variable, variableRows);
    }

    const series = factorNames
      .sort(
        (leftVariable, rightVariable) =>
          (factorOrder.get(leftVariable) ?? Number.MAX_SAFE_INTEGER) -
          (factorOrder.get(rightVariable) ?? Number.MAX_SAFE_INTEGER)
      )
      .map((variable) => {
        const variableRows = variableRowsMap.get(variable) ?? [];
        const orderedRows = variableRows
          .filter(
            (
              row
            ): row is StockIndicatorRow & {
              date: string;
              value: number;
            } =>
              row.date !== null &&
              row.value !== null &&
              !Number.isNaN(row.value)
          )
          .sort((leftRow, rightRow) => leftRow.date.localeCompare(rightRow.date));

        if (orderedRows.length === 0) {
          return {
            variable,
            series: []
          };
        }

        const firstRow = orderedRows[0];

        if (!firstRow) {
          return {
            variable,
            series: []
          };
        }

        const baseValue = firstRow.value;

        if (baseValue === 0) {
          return {
            variable,
            series: []
          };
        }

        return {
          variable,
          series: orderedRows.map((row) => ({
            date: row.date,
            value: roundToFourDecimals((row.value / baseValue) * 100)
          }))
        };
      });

    return {
      ticker: normalizedTicker,
      count: factorNames.length,
      rebasing_basis: "first_value_per_variable_base_100",
      series
    };
  });
}
