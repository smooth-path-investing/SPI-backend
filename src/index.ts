import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { env } from "./config/env";
import { HttpError } from "./http/errors";
import {
  isOriginAllowed,
  sendJson,
  sendMethodNotAllowed,
  sendNoContent,
  sendOriginNotAllowed
} from "./http/response";
import {
  getAllStockTickers,
  getStockAssetChartSeriesByTicker
} from "./services/stockAssets";
import { getAllStockEtfFactors } from "./services/stockEtf";
import { getStockFactorBarGraphByTicker } from "./services/stockFactorCoefvec";
import { getStockFundamentalRebasedSeriesByTicker } from "./services/stockFundamental";
import { normalizeTicker } from "./services/shared";

type Route = {
  handler: (match: RegExpExecArray) => Promise<unknown>;
  method: "GET";
  pattern: RegExp;
};

const routes: Route[] = [
  {
    method: "GET",
    pattern: /^\/health$/,
    handler: async () => ({
      status: "ok"
    })
  },
  {
    method: "GET",
    pattern: /^\/stock-assets\/tickers$/,
    handler: async () => {
      const tickers = await getAllStockTickers();

      return {
        count: tickers.length,
        tickers
      };
    }
  },
  {
    method: "GET",
    pattern: /^\/stock-etf\/factors$/,
    handler: async () => {
      const factors = await getAllStockEtfFactors();

      return {
        count: factors.length,
        factors
      };
    }
  },
  {
    method: "GET",
    pattern: /^\/stock-factor-coefvec\/([^/]+)\/bar-graph$/,
    handler: async (match) => {
      const ticker = getTickerFromMatch(match);
      const barGraph = await getStockFactorBarGraphByTicker(ticker);

      if (!barGraph) {
        throw new HttpError(
          404,
          `No factor coefficient data was found for ticker ${ticker}.`
        );
      }

      return barGraph;
    }
  },
  {
    method: "GET",
    pattern: /^\/stock-fundamental\/([^/]+)\/rebased-series$/,
    handler: async (match) => {
      const ticker = getTickerFromMatch(match);
      const rebasedSeries = await getStockFundamentalRebasedSeriesByTicker(ticker);

      if (!rebasedSeries) {
        throw new HttpError(
          404,
          `No rebased indicator data was found for ticker ${ticker}.`
        );
      }

      return rebasedSeries;
    }
  },
  {
    method: "GET",
    pattern: /^\/stock-assets\/([^/]+)$/,
    handler: async (match) => {
      const ticker = getTickerFromMatch(match);
      const chartSeries = await getStockAssetChartSeriesByTicker(ticker);

      if (!chartSeries) {
        throw new HttpError(404, `No price data was found for ticker ${ticker}.`);
      }

      return chartSeries;
    }
  }
];

function decodePathSegment(value: string | undefined, label: string): string {
  if (!value) {
    throw new HttpError(400, `${label} is required.`);
  }

  try {
    return decodeURIComponent(value);
  } catch {
    throw new HttpError(400, `${label} contains invalid URL encoding.`);
  }
}

function getTickerFromMatch(match: RegExpExecArray): string {
  return normalizeTicker(decodePathSegment(match[1], "Ticker"));
}

function getErrorStatusCode(error: unknown): number {
  return error instanceof HttpError ? error.statusCode : 500;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof HttpError) {
    return error.message;
  }

  if (!env.isProduction && error instanceof Error) {
    return error.message;
  }

  return "Internal server error.";
}

async function resolveRoute(
  method: IncomingMessage["method"],
  pathname: string
): Promise<unknown | null> {
  for (const route of routes) {
    if (route.method !== method) {
      continue;
    }

    const match = route.pattern.exec(pathname);

    if (match) {
      return route.handler(match);
    }
  }

  return null;
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const requestUrl = new URL(req.url ?? "/", "http://localhost");

  if (!isOriginAllowed(req)) {
    sendOriginNotAllowed(req, res);
    return;
  }

  if (req.method === "OPTIONS") {
    sendNoContent(req, res, 204, {
      Allow: "GET, OPTIONS"
    });
    return;
  }

  if (req.method !== "GET") {
    sendMethodNotAllowed(req, res);
    return;
  }

  try {
    const payload = await resolveRoute(req.method, requestUrl.pathname);

    if (payload === null) {
      sendJson(req, res, 404, {
        message: "Route not found.",
        method: req.method,
        url: requestUrl.pathname
      });
      return;
    }

    sendJson(req, res, 200, payload);
  } catch (error) {
    sendJson(req, res, getErrorStatusCode(error), {
      message: getErrorMessage(error)
    });
  }
}

export function startServer(): void {
  const server = createServer((req, res) => {
    void handleRequest(req, res);
  });

  server.headersTimeout = env.headersTimeoutMs;
  server.keepAliveTimeout = env.keepAliveTimeoutMs;
  server.maxHeadersCount = 64;
  server.requestTimeout = env.requestTimeoutMs;

  let shuttingDown = false;

  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log(`Received ${signal}. Shutting down HTTP server...`);

    server.close((error) => {
      if (error) {
        console.error("Failed to close server cleanly:", error);
        process.exit(1);
      }

      process.exit(0);
    });
  };

  process.once("SIGINT", () => {
    shutdown("SIGINT");
  });

  process.once("SIGTERM", () => {
    shutdown("SIGTERM");
  });

  server.listen(env.port, env.host, () => {
    console.log(
      `SPI backend listening on http://${env.host}:${env.port} (${env.appEnvironment})`
    );
  });
}
