import { createHmac, timingSafeEqual } from "node:crypto";
import { Request, Response, Router } from "express";
import { SWController, SWLogger } from "simple-wire";
import { DeployService } from "@/domain/deploy/deploy.service";
import { Config } from "@/setup/config";

// The JSON parser in index.ts keeps the exact bytes for /hooks/* requests,
// since GitHub signs the body as sent, not as re-serialised.
export type RawBodyRequest = Request & { rawBody?: Buffer };

function hasValidSignature(secret: string, body: Buffer, header: string): boolean {
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(body).digest("hex")}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export class DeployHookController implements SWController {
  constructor(
    private readonly logger: SWLogger,
    private readonly cfg: Config,
    private readonly deployService: DeployService,
  ) {}

  public register(router: Router): void {
    router.post("/hooks/github", this.github);
  }

  private github = async (req: RawBodyRequest, res: Response): Promise<void> => {
    const secret = this.cfg.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
      res.status(404).end();
      return;
    }

    const signature = req.get("x-hub-signature-256");
    if (!req.rawBody || !signature || !hasValidSignature(secret, req.rawBody, signature)) {
      this.logger.info("Rejected a GitHub webhook with a bad signature");
      res.status(401).json({ error: "Bad signature" });
      return;
    }

    // Any release event (published, deleted, marked latest) may change which
    // release is latest, so each one is worth a look.
    const event = req.get("x-github-event");
    if (event !== "release") {
      res.status(200).json({ ignored: event });
      return;
    }

    try {
      await this.deployService.requestDeploy();
      res.status(202).json({ requested: true });
    } catch (err) {
      this.logger.error(`Deploy request failed: ${(err as Error).message}`);
      res.status(500).json({ error: "Could not request a deploy" });
    }
  };
}
