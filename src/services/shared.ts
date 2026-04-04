import { HttpError } from "../http/errors";

const PAGE_SIZE = 1000;
const TICKER_PATTERN = /^[A-Z0-9./-]{1,20}$/;

export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const pageRows = await fetchPage(from, from + PAGE_SIZE - 1);
    rows.push(...pageRows);

    if (pageRows.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return rows;
}

export function normalizeTicker(rawTicker: string): string {
  const normalizedTicker = rawTicker.trim().toUpperCase();

  if (!normalizedTicker) {
    throw new HttpError(400, "Ticker is required.");
  }

  if (!TICKER_PATTERN.test(normalizedTicker)) {
    throw new HttpError(
      400,
      "Ticker must contain only letters, numbers, dots, slashes, or hyphens."
    );
  }

  return normalizedTicker;
}

export function normalizeNullableText(value: string | null | undefined): string | null {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : null;
}

export function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(new Set(values)).sort((left, right) =>
    left.localeCompare(right)
  );
}
