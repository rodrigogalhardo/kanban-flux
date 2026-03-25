import { Worker, Job } from "bullmq";
import IORedis from "ioredis";

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
      console.log(`[Worker] Processing run ${runId} (job ${job.id})`);

      try {
        await executeRun(runId);
        console.log(`[Worker] Run ${runId} completed successfully`);
      } catch (error) {
        console.error(`[Worker] Run ${runId} failed:`, error);
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
    console.log(`[Worker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error(`[Worker] Worker error:`, err);
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
