import { loadEnvironmentFiles, resolveAppEnvironment } from "./config/loadEnv";

function registerProcessHandlers(): void {
  process.on("unhandledRejection", (reason) => {
    console.error("Unhandled promise rejection:", reason);
  });

  process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error);
    process.exit(1);
  });
}

function bootstrap(): void {
  const appEnvironment = resolveAppEnvironment(process.argv[2]);
  loadEnvironmentFiles(appEnvironment);
  registerProcessHandlers();

  const { startServer } = require("./index") as typeof import("./index");
  startServer();
}

bootstrap();
