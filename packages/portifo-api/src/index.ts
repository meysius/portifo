import "dotenv/config";
import path from "node:path";
import express, { Router, Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { buildApp } from "@/setup/app";
import { AsyncContext } from "@/setup/async-context";

const app = buildApp();

const expressApp = express();
expressApp.use(express.json());
expressApp.use(cookieParser());

expressApp.use((req: Request, _res: Response, next: NextFunction) => {
  app.asyncStorage.run(new AsyncContext(req), () => next());
});

const router = Router();
for (const controller of app.controllers) {
  controller.register(router);
}
expressApp.use(router);

if (app.cfg.NODE_ENV === "production") {
  const webDist = path.join(__dirname, "../../portifo-web/dist");
  expressApp.use(express.static(webDist));
  expressApp.use((_req: Request, res: Response) => {
    res.sendFile(path.join(webDist, "index.html"));
  });
}

const server = expressApp.listen(app.cfg.PORT, () => {
  app.logger.info(`Service started on port ${app.cfg.PORT}.`);
});

const shutdown = async () => {
  app.logger.info("SIGTERM received. Shutting down gracefully...");
  const forceExit = setTimeout(() => {
    app.logger.info("Shutdown timed out, forcing exit.");
    process.exit(1);
  }, 5000).unref();

  server.closeAllConnections();
  server.close(async () => {
    clearTimeout(forceExit);
    await app.shutdown();
    app.logger.info("Closed out remaining connections.");
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
