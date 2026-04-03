import { supabase } from "../lib/supabase";

type StockEtfVariableRow = {
  variable: string | null;
};

export type StockEtfRow = {
  id: number;
  quarter_end: string | null;
  date: string | null;
  variable: string | null;
  value: number | null;
};

const PAGE_SIZE = 1000;
const STOCK_ETF_TABLE = "stock_etf";

export async function getAllStockEtfFactors(): Promise<string[]> {
  const uniqueFactors = new Set<string>();
  let start = 0;

  while (true) {
    const { data, error } = await supabase
      .from(STOCK_ETF_TABLE)
      .select("variable")
      .range(start, start + PAGE_SIZE - 1)
      .returns<StockEtfVariableRow[]>();

    if (error) {
      throw new Error(
        `Failed to read factors from ${STOCK_ETF_TABLE}: ${error.message}`
      );
    }

    const rows = data ?? [];

    for (const row of rows) {
      const factor = row.variable?.trim();

      if (factor) {
        uniqueFactors.add(factor);
      }
    }

    if (rows.length < PAGE_SIZE) {
      break;
    }

    start += PAGE_SIZE;
  }

  return Array.from(uniqueFactors).sort((left, right) =>
    left.localeCompare(right)
  );
}

export async function getStockEtfRowsByVariables(
  variables: string[]
): Promise<StockEtfRow[]> {
  const normalizedVariables = Array.from(
    new Set(
      variables
        .map((variable) => variable.trim().toUpperCase())
        .filter((variable) => variable.length > 0)
    )
  );

  if (normalizedVariables.length === 0) {
    return [];
  }

  const rows: StockEtfRow[] = [];
  let start = 0;

  while (true) {
    const { data, error } = await supabase
      .from(STOCK_ETF_TABLE)
      .select("*")
      .in("variable", normalizedVariables)
      .order("variable", { ascending: true })
      .order("date", { ascending: true })
      .range(start, start + PAGE_SIZE - 1)
      .returns<StockEtfRow[]>();

    if (error) {
      throw new Error(
        `Failed to read factor series from ${STOCK_ETF_TABLE}: ${error.message}`
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
