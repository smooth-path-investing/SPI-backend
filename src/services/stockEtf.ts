import { env } from "../config/env";
import { TtlCache } from "../lib/cache";
import { supabase } from "../lib/supabase";
import { fetchAllPages, normalizeNullableText, uniqueSorted } from "./shared";

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

const STOCK_ETF_TABLE = "stock_etf";
const factorCache = new TtlCache<string[]>(env.cacheTtlMs);

export async function getAllStockEtfFactors(): Promise<string[]> {
  return factorCache.getOrLoad("all", async () => {
    const rows = await fetchAllPages<StockEtfVariableRow>(async (from, to) => {
      const { data, error } = await supabase
        .from(STOCK_ETF_TABLE)
        .select("variable")
        .range(from, to)
        .returns<StockEtfVariableRow[]>();

      if (error) {
        throw new Error(
          `Failed to read factors from ${STOCK_ETF_TABLE}: ${error.message}`
        );
      }

      return data ?? [];
    });

    return uniqueSorted(
      rows.flatMap((row) => {
        const factor = normalizeNullableText(row.variable);
        return factor ? [factor] : [];
      })
    );
  });
}

export async function getStockEtfRowsByVariables(
  variables: string[]
): Promise<StockEtfRow[]> {
  const normalizedVariables = Array.from(
    new Set(
      variables
        .map((variable) => variable.trim())
        .filter((variable) => variable.length > 0)
    )
  );

  if (normalizedVariables.length === 0) {
    return [];
  }

  return fetchAllPages<StockEtfRow>(async (from, to) => {
    const { data, error } = await supabase
      .from(STOCK_ETF_TABLE)
      .select("id, quarter_end, date, variable, value")
      .in("variable", normalizedVariables)
      .order("variable", { ascending: true })
      .order("date", { ascending: true })
      .range(from, to)
      .returns<StockEtfRow[]>();

    if (error) {
      throw new Error(
        `Failed to read factor series from ${STOCK_ETF_TABLE}: ${error.message}`
      );
    }

    return data ?? [];
  });
}
