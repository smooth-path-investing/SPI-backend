import { supabase } from "../lib/supabase";

type StockFactorCoefvecRow = {
  factor_name: string | null;
  coefficients: unknown;
};

export type StockFactorBarValue = {
  factor_name: string;
  normalized_value: number;
};

export type StockFactorBarGraphResponse = {
  ticker: string;
  count: number;
  normalization_basis: "sum_of_absolute_total_coefficients";
  bars: StockFactorBarValue[];
};

const PAGE_SIZE = 1000;
const STOCK_FACTOR_COEFVEC_TABLE = "stock_factor_coefvec";

function parseNumericValue(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isNaN(value) ? null : value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return null;
  }

  const parsedValue = Number(trimmedValue);

  return Number.isNaN(parsedValue) ? null : parsedValue;
}

function parseNumericArray(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => parseNumericValue(entry))
      .filter((entry): entry is number => entry !== null);
  }

  if (typeof value !== "string") {
    return [];
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return [];
  }

  try {
    const parsedJson = JSON.parse(trimmedValue);

    if (Array.isArray(parsedJson)) {
      return parseNumericArray(parsedJson);
    }
  } catch {
    // Fall through to PostgreSQL array literal parsing.
  }

  if (trimmedValue.startsWith("{") && trimmedValue.endsWith("}")) {
    return trimmedValue
      .slice(1, -1)
      .split(",")
      .map((entry) => parseNumericValue(entry))
      .filter((entry): entry is number => entry !== null);
  }

  const parsedValue = parseNumericValue(trimmedValue);

  return parsedValue === null ? [] : [parsedValue];
}

async function getStockFactorCoefvecRowsByTicker(
  ticker: string
): Promise<StockFactorCoefvecRow[]> {
  const normalizedTicker = ticker.trim().toUpperCase();
  const rows: StockFactorCoefvecRow[] = [];
  let start = 0;

  while (true) {
    const { data, error } = await supabase
      .from(STOCK_FACTOR_COEFVEC_TABLE)
      .select("factor_name, coefficients")
      .eq("stock_symbol", normalizedTicker)
      .range(start, start + PAGE_SIZE - 1)
      .returns<StockFactorCoefvecRow[]>();

    if (error) {
      throw new Error(
        `Failed to read factor coefficient vectors for ${normalizedTicker}: ${error.message}`
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

export async function getStockFactorBarGraphByTicker(
  ticker: string
): Promise<StockFactorBarGraphResponse | null> {
  const normalizedTicker = ticker.trim().toUpperCase();
  const rows = await getStockFactorCoefvecRowsByTicker(normalizedTicker);

  if (rows.length === 0) {
    return null;
  }

  const factorTotals = new Map<string, number>();

  for (const row of rows) {
    const factorName = row.factor_name?.trim();

    if (!factorName) {
      continue;
    }

    const coefficientSum = parseNumericArray(row.coefficients).reduce(
      (sum, coefficient) => sum + coefficient,
      0
    );

    factorTotals.set(
      factorName,
      (factorTotals.get(factorName) ?? 0) + coefficientSum
    );
  }

  if (factorTotals.size === 0) {
    return null;
  }

  const denominator = Array.from(factorTotals.values()).reduce(
    (sum, totalCoefficient) => sum + Math.abs(totalCoefficient),
    0
  );

  const bars = Array.from(factorTotals.entries())
    .map(([factor_name, totalCoefficient]) => ({
      factor_name,
      normalized_value:
        denominator === 0 ? 0 : totalCoefficient / denominator
    }))
    .sort((left, right) => {
      const normalizedDifference =
        right.normalized_value - left.normalized_value;

      if (normalizedDifference !== 0) {
        return normalizedDifference;
      }

      return left.factor_name.localeCompare(right.factor_name);
    });

  return {
    ticker: normalizedTicker,
    count: bars.length,
    normalization_basis: "sum_of_absolute_total_coefficients",
    bars
  };
}
