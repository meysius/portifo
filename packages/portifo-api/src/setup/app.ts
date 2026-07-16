import { AsyncLocalStorage } from "async_hooks";
import { PinoLogger, createAsyncContextGetter, SWController } from "simple-wire";
import { Config, ConfigSchema } from "@/setup/config";
import { AsyncContext } from "@/setup/async-context";
import { createDbClient, DrizzleDb } from "@/setup/db";
import { DrizzleIdentityRepo } from "@/domain/identity/identity.repo";
import { IdentityService } from "@/domain/identity/identity.service";
import { AuthService } from "@/domain/auth/auth.service";
import { DrizzlePortfolioRepo } from "@/domain/portfolio/portfolio.repo";
import { PortfolioService } from "@/domain/portfolio/portfolio.service";
import { MarketService } from "@/domain/market/market.service";
import { DrizzlePushRepo } from "@/domain/push/push.repo";
import { PushService } from "@/domain/push/push.service";
import { UsersController } from "@/controllers/users.controller";
import { AuthController } from "@/controllers/auth.controller";
import { PortfolioController } from "@/controllers/portfolio.controller";
import { MarketController } from "@/controllers/market.controller";
import { PushController } from "@/controllers/push.controller";

export type App = {
  cfg: Config;
  logger: PinoLogger;
  db: DrizzleDb;
  asyncStorage: AsyncLocalStorage<AsyncContext>;
  controllers: SWController[];
  shutdown: () => Promise<void>;
};

export function buildApp(): App {
  const cfg = ConfigSchema.parse(process.env);
  const asyncStorage = new AsyncLocalStorage<AsyncContext>();
  const getAsyncContext = createAsyncContextGetter(asyncStorage);

  const logger = new PinoLogger(cfg, getAsyncContext);
  const db = createDbClient(cfg);

  const identityRepo = new DrizzleIdentityRepo(db);
  const identityService = new IdentityService(logger, identityRepo);
  const authService = new AuthService(logger, cfg);
  const portfolioRepo = new DrizzlePortfolioRepo(db);
  const marketService = new MarketService(logger);
  const portfolioService = new PortfolioService(logger, portfolioRepo, marketService);
  const pushRepo = new DrizzlePushRepo(db);
  const pushService = new PushService(logger, pushRepo, cfg);

  const controllers: SWController[] = [
    new UsersController(logger, identityService),
    new AuthController(logger, authService, identityService),
    new PortfolioController(logger, authService, identityService, portfolioService),
    new MarketController(logger, authService, identityService, marketService),
    new PushController(logger, cfg, authService, identityService, pushService),
  ];

  return {
    cfg,
    logger,
    db,
    asyncStorage,
    controllers,
    shutdown: async () => {
      // Close DB connections, etc.
    },
  };
}
