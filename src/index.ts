import { createServer } from "node:http";
import { URL } from "node:url";

import { env } from "./config/env";
import {
  getAllStockTickers,
  getStockAssetChartSeriesByTicker
} from "./services/stockAssets";

const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host}`);

  if (req.method === "GET" && requestUrl.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/stock-assets/tickers") {
    try {
      const tickers = await getAllStockTickers();

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ tickers, count: tickers.length }));
      return;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown server error.";

      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message }));
      return;
    }
  }

  const stockAssetSeriesMatch = requestUrl.pathname.match(
    /^\/stock-assets\/([^/]+)$/
  );

  if (req.method === "GET" && stockAssetSeriesMatch) {
    try {
      const ticker = decodeURIComponent(stockAssetSeriesMatch[1]).trim();
      const chartSeries = await getStockAssetChartSeriesByTicker(ticker);

      if (!chartSeries) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            message: `No price data was found for ticker ${ticker.toUpperCase()}.`
          })
        );
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(chartSeries));
      return;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown server error.";

      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message }));
      return;
    }
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      message: "Route not found.",
      method: req.method,
      url: requestUrl.pathname
    })
  );
});

server.listen(env.port, () => {
  console.log(`Server running at http://localhost:${env.port}`);
});
