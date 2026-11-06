import { AsyncLocalStorage } from "async_hooks";
import { PinoLogger, createAsyncContextGetter, SWController } from "simple-wire";
import { Config, ConfigSchema } from "@/setup/config";
import { AsyncContext } from "@/setup/async-context";
import { createDbClient, DrizzleDb } from "@/setup/db";
import { BackgroundJob, BullJobQueue } from "@/setup/jobs";
import { DrizzleIdentityRepo } from "@/domain/identity/identity.repo";
import { IdentityService } from "@/domain/identity/identity.service";
import { AuthService } from "@/domain/auth/auth.service";
import { DrizzlePortfolioRepo } from "@/domain/portfolio/portfolio.repo";
import { PortfolioService } from "@/domain/portfolio/portfolio.service";
import { MarketService } from "@/domain/market/market.service";
import { LiveQuoteService } from "@/domain/market/live-quote.service";
import { YahooStreamer } from "@/domain/market/yahoo-streamer";
import { DrizzlePushRepo } from "@/domain/push/push.repo";
import { PushService } from "@/domain/push/push.service";
import { DrizzleWatchlistRepo } from "@/domain/watchlist/watchlist.repo";
import { WatchlistService } from "@/domain/watchlist/watchlist.service";
import { DrizzleAlertRepo } from "@/domain/alert/alert.repo";
import { AlertService } from "@/domain/alert/alert.service";
import { UsersController } from "@/controllers/users.controller";
import { AuthController } from "@/controllers/auth.controller";
import { PortfolioController } from "@/controllers/portfolio.controller";
import { MarketController } from "@/controllers/market.controller";
import { PushController } from "@/controllers/push.controller";
import { WatchlistController } from "@/controllers/watchlist.controller";
import { AlertController } from "@/controllers/alert.controller";
import { CheckAlertsJob } from "@/jobs/alert.job";
import { SendPushJob } from "@/jobs/push.job";

export type App = {
  cfg: Config;
  logger: PinoLogger;
  db: DrizzleDb;
  asyncStorage: AsyncLocalStorage<AsyncContext>;
  controllers: SWController[];
  jobQueue: BullJobQueue;
  jobs: BackgroundJob[];
  shutdown: () => Promise<void>;
};

export function buildApp(): App {
  const cfg = ConfigSchema.parse(process.env);
  const asyncStorage = new AsyncLocalStorage<AsyncContext>();
  const getAsyncContext = createAsyncContextGetter(asyncStorage);

  const logger = new PinoLogger(cfg, getAsyncContext);
  const db = createDbClient(cfg, logger);
  const jobQueue = new BullJobQueue(logger, cfg);

  const identityRepo = new DrizzleIdentityRepo(db);
  const identityService = new IdentityService(logger, identityRepo);
  const authService = new AuthService(logger, cfg);
  const portfolioRepo = new DrizzlePortfolioRepo(db);
  const marketService = new MarketService(logger);
  const liveQuoteService = new LiveQuoteService(logger, marketService, new YahooStreamer(logger));
  const portfolioService = new PortfolioService(logger, portfolioRepo, marketService);
  const pushRepo = new DrizzlePushRepo(db);
  const pushService = new PushService(logger, pushRepo, jobQueue, cfg);
  const watchlistRepo = new DrizzleWatchlistRepo(db);
  const watchlistService = new WatchlistService(logger, watchlistRepo);
  const alertRepo = new DrizzleAlertRepo(db);
  const alertService = new AlertService(logger, alertRepo, liveQuoteService, pushService);

  const controllers: SWController[] = [
    new UsersController(logger, identityService),
    new AuthController(logger, authService, identityService),
    new PortfolioController(logger, authService, identityService, portfolioService),
    new MarketController(logger, authService, identityService, marketService, liveQuoteService),
    new PushController(logger, cfg, authService, identityService, pushService),
    new WatchlistController(logger, authService, identityService, watchlistService),
    new AlertController(logger, authService, identityService, alertService),
  ];

  const jobs: BackgroundJob[] = [new CheckAlertsJob(alertService), new SendPushJob(pushService)];

  return {
    cfg,
    logger,
    db,
    asyncStorage,
    controllers,
    jobQueue,
    jobs,
    shutdown: async () => {
      liveQuoteService.stop();
      await jobQueue.stop();
      // Close DB connections, etc.
    },
  };
}
