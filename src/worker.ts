import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { workerLogger } from "@/lib/logger";

// We need to set up the Prisma client and module aliases since this runs outside Next.js
// The worker imports the executor directly

const QUEUE_NAME = "agent-runs";
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || "5", 10);

async function main() {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  console.log(`[Worker] Starting agent worker with concurrency=${CONCURRENCY}`);
  console.log(`[Worker] Connected to Redis: ${redisUrl}`);

  // Dynamic import to ensure prisma is initialized
  const { executeRun } = await import("./lib/agents/executor");

  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      const { runId } = job.data;
      workerLogger.info("Processing run", { runId, jobId: job.id ?? undefined });

      try {
        await executeRun(runId);
        workerLogger.info("Run completed successfully", { runId, jobId: job.id ?? undefined });
      } catch (error) {
        workerLogger.error("Run failed", { runId, error: error instanceof Error ? error.message : String(error) });
        throw error; // Let BullMQ handle retries
      }
    },
    {
      connection,
      concurrency: CONCURRENCY,
      limiter: {
        max: 10,
        duration: 60000, // max 10 jobs per minute (rate limiting)
      },
    }
  );

  worker.on("completed", (job) => {
    workerLogger.info("Job completed", { jobId: job.id ?? undefined });
  });

  worker.on("failed", (job, err) => {
    workerLogger.error("Job failed", { jobId: job?.id ?? undefined, error: err.message });
  });

  worker.on("error", (err) => {
    workerLogger.error("Worker error", { error: err.message });
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[Worker] Received ${signal}, shutting down gracefully...`);
    await worker.close();
    await connection.quit();
    console.log(`[Worker] Shutdown complete`);
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  console.log(`[Worker] Ready and waiting for jobs...`);
}

main().catch((err) => {
  console.error("[Worker] Fatal error:", err);
  process.exit(1);
});
