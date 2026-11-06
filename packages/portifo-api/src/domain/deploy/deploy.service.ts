import { writeFile } from "node:fs/promises";
import { SWLogger } from "simple-wire";
import { Config } from "@/setup/config";

export class DeployService {
  constructor(
    private readonly logger: SWLogger,
    private readonly cfg: Config,
  ) {}

  // Asks the server to check GitHub for a new release now instead of at its
  // next timer tick. It names nothing to deploy: portifo-deploy.path sees the
  // file change and starts the root-owned deploy script, which looks up the
  // latest release on GitHub itself. So whoever triggers this can't choose
  // what runs. All they can do is make the server look early.
  async requestDeploy(): Promise<void> {
    await writeFile(this.cfg.DEPLOY_REQUEST_FILE, `${new Date().toISOString()}\n`);
    this.logger.info("Deploy check requested");
  }
}
