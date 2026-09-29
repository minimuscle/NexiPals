import { loadConfig } from "./config.js";
import { startServer } from "./server.js";

const config = loadConfig();
const { server } = startServer(config);

console.info(`NexiPals listening on ${server.hostname}:${server.port}`);

const shutdown = async (signal: string): Promise<void> => {
  console.info(`Received ${signal}; shutting down`);
  await server.stop(true);
  process.exit(0);
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
