import { createPostgresBackend, JobsOptions, withBackend } from "bullmq";
import { SWLogger } from "simple-wire";
import { Config } from "@/setup/config";

const { Queue, Worker } = withBackend(createPostgresBackend);

const QUEUE_NAME = "background";

// Slots for jobs running at once, so one slow job doesn't hold up the rest.
const CONCURRENCY = 5;

// Finished jobs are kept only to look back at: a check alone adds 1,440 a day.
const RETAIN: JobsOptions = { removeOnComplete: { count: 200 }, removeOnFail: { count: 1000 } };

// Enough to ride out a push service's bad couple of minutes.
const RETRY: JobsOptions = { attempts: 6, backoff: { type: "exponential", delay: 5_000 } };

// A unit of background work, the queue's counterpart to a controller: it takes
// the job's data and hands it to a domain service. BullMQ has no job timeout
// and a hung job holds its slot, so anything `run` waits on needs its own.
export interface BackgroundJob<T = any> {
  readonly name: string;
  // Repeats on this interval, on a schedule kept in the database. The next tick
  // is its retry. Without one, a job runs when enqueued and retries on failure.
  // Ticks can overlap when a job runs long, so `run` must tolerate that.
  readonly everyMs?: number;
  run(data: T): Promise<void>;
}

export interface JobQueue {
  enqueue(name: string, data: unknown): Promise<void>;
}

// BullMQ on its PostgreSQL backend: jobs live in the `bullmq` schema of the app's
// own database (see scripts/jobs-migrate.ts), so there's nothing else to run.
export class BullJobQueue implements JobQueue {
  private queue: InstanceType<typeof Queue> | null = null;
  private worker: InstanceType<typeof Worker> | null = null;

  constructor(
    private readonly logger: SWLogger,
    private readonly cfg: Config,
  ) {}

  async start(jobs: BackgroundJob[]): Promise<void> {
    const connection = { connectionString: this.cfg.DATABASE_URL, max: 4 };
    const byName = new Map(jobs.map((job) => [job.name, job]));

    const queue = new Queue(QUEUE_NAME, { connection, defaultJobOptions: { ...RETRY, ...RETAIN } });
    queue.on("error", (err) => this.logger.error(`Job queue error: ${err.message}`));
    await queue.waitUntilReady();
    this.queue = queue;

    // Keyed by name, so a restart updates a schedule rather than adding another.
    for (const job of jobs) {
      if (job.everyMs == null) continue;
      await queue.upsertJobScheduler(job.name, { every: job.everyMs }, { name: job.name, opts: { attempts: 1, ...RETAIN } });
    }

    const worker = new Worker(
      QUEUE_NAME,
      async (job) => {
        const handler = byName.get(job.name);
        if (!handler) throw new Error(`No handler for job "${job.name}"`);
        await handler.run(job.data);
      },
      { connection, concurrency: CONCURRENCY },
    );
    worker.on("error", (err) => this.logger.error(`Job worker error: ${err.message}`));
    worker.on("failed", (job, err) => {
      this.logger.error(`Job ${job?.name} failed (attempt ${job?.attemptsMade}): ${err.message}`);
    });
    await worker.waitUntilReady();
    this.worker = worker;
  }

  async enqueue(name: string, data: unknown): Promise<void> {
    if (!this.queue) throw new Error("Job queue isn't started");
    await this.queue.add(name, data);
  }

  // Waits for running jobs. One cut off by the process exiting is run again
  // after the next start, once its lock expires.
  async stop(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }
}
