import { env } from "./config/env.js";
import { disconnectPrisma } from "./config/prisma.js";
import { auth } from "./config/auth.js";
import { redis } from "./config/redis.js";
import { waWorker } from "./modules/scheduler/index.js";
import app from "./app.js";

// Pastikan worker jalan (side-effect import)
void waWorker;

await auth.migrate();

const server = app.listen(env.PORT, () => {
  console.log(`🚀 uangkost API running at http://localhost:${env.PORT}`);
  console.log(`📋 Environment: ${env.NODE_ENV}`);
});

// Graceful shutdown
function gracefulShutdown(signal: string): void {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  server.close(async () => {
    console.log("HTTP server closed");

    try {
      await disconnectPrisma();
      console.log("Prisma disconnected");

      await redis.quit();
      console.log("Redis disconnected");

      process.exit(0);
    } catch (err) {
      console.error("Error during shutdown:", (err as Error).message);
      process.exit(1);
    }
  });

  // Force shutdown after 10s
  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle unhandled rejections
process.on("unhandledRejection", (reason: unknown) => {
  console.error("Unhandled rejection:", reason);
});

process.on("uncaughtException", (err: Error) => {
  console.error("Uncaught exception:", err.message);
  gracefulShutdown("uncaughtException");
});
