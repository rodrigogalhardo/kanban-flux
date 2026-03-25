import { Queue } from "bullmq";
import { getRedisConnection } from "@/lib/redis";

const QUEUE_NAME = "agent-runs";

let queue: Queue | null = null;

function getQueue(): Queue {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
  }
  return queue;
}

export async function enqueueAgentRun(runId: string, priority?: number): Promise<string> {
  const job = await getQueue().add(
    "execute-run",
    { runId },
    {
      priority: priority || 0,
      jobId: `run-${runId}`,
    }
  );
  return job.id || runId;
}

export async function getQueueStats() {
  const q = getQueue();
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    q.getWaitingCount(),
    q.getActiveCount(),
    q.getCompletedCount(),
    q.getFailedCount(),
    q.getDelayedCount(),
  ]);
  return { waiting, active, completed, failed, delayed };
}

export { QUEUE_NAME };
