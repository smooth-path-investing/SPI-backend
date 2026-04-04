import { existsSync } from "node:fs";
import { resolve } from "node:path";

const APP_ENVIRONMENTS = ["development", "production", "test"] as const;

export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

function isAppEnvironment(value: string): value is AppEnvironment {
  return APP_ENVIRONMENTS.includes(value as AppEnvironment);
}

export function resolveAppEnvironment(rawValue?: string): AppEnvironment {
  const candidate = (
    rawValue ??
    process.env.APP_ENV ??
    process.env.NODE_ENV ??
    "development"
  )
    .trim()
    .toLowerCase();

  if (!isAppEnvironment(candidate)) {
    throw new Error(
      `APP_ENV must be one of ${APP_ENVIRONMENTS.join(", ")}. Received "${candidate}".`
    );
  }

  return candidate;
}

export function loadEnvironmentFiles(
  appEnvironment: AppEnvironment,
  cwd = process.cwd()
): void {
  const candidateFiles = [
    `.env.${appEnvironment}.local`,
    ".env.local",
    `.env.${appEnvironment}`,
    ".env"
  ];

  for (const fileName of candidateFiles) {
    const filePath = resolve(cwd, fileName);

    if (existsSync(filePath)) {
      process.loadEnvFile(filePath);
    }
  }

  process.env.APP_ENV ??= appEnvironment;
  process.env.NODE_ENV ??=
    appEnvironment === "production" ? "production" : "development";
}
