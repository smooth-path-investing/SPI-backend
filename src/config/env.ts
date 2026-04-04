import type { AppEnvironment } from "./loadEnv";
import { resolveAppEnvironment } from "./loadEnv";

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function readIntegerEnv(
  name: string,
  defaultValue: number,
  options: { max?: number; min?: number } = {}
): number {
  const rawValue = process.env[name]?.trim();

  if (!rawValue) {
    return defaultValue;
  }

  const parsedValue = Number(rawValue);

  if (!Number.isInteger(parsedValue)) {
    throw new Error(`${name} must be an integer. Received "${rawValue}".`);
  }

  if (options.min !== undefined && parsedValue < options.min) {
    throw new Error(`${name} must be greater than or equal to ${options.min}.`);
  }

  if (options.max !== undefined && parsedValue > options.max) {
    throw new Error(`${name} must be less than or equal to ${options.max}.`);
  }

  return parsedValue;
}

function readListEnv(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function resolveSupabaseKey(): string {
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
  const supabaseKey = publishableKey || anonKey;

  if (!supabaseKey) {
    throw new Error(
      "Either SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY is required."
    );
  }

  return supabaseKey;
}

const appEnvironment = resolveAppEnvironment() as AppEnvironment;

export const env = {
  appEnvironment,
  cacheTtlMs: readIntegerEnv("CACHE_TTL_MS", 60_000, {
    min: 0,
    max: 3_600_000
  }),
  corsAllowedOrigins: readListEnv("CORS_ALLOWED_ORIGINS"),
  headersTimeoutMs: readIntegerEnv("HEADERS_TIMEOUT_MS", 10_000, {
    min: 1_000,
    max: 120_000
  }),
  host: process.env.HOST?.trim() || "0.0.0.0",
  isProduction: appEnvironment === "production",
  keepAliveTimeoutMs: readIntegerEnv("KEEP_ALIVE_TIMEOUT_MS", 5_000, {
    min: 1_000,
    max: 60_000
  }),
  port: readIntegerEnv("PORT", 3000, {
    min: 1,
    max: 65_535
  }),
  requestTimeoutMs: readIntegerEnv("REQUEST_TIMEOUT_MS", 15_000, {
    min: 1_000,
    max: 120_000
  }),
  supabaseKey: resolveSupabaseKey(),
  supabaseUrl: readRequiredEnv("SUPABASE_URL")
};

if (env.headersTimeoutMs <= env.keepAliveTimeoutMs) {
  throw new Error("HEADERS_TIMEOUT_MS must be greater than KEEP_ALIVE_TIMEOUT_MS.");
}
