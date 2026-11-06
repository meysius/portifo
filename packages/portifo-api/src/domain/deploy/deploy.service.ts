import { writeFile } from "node:fs/promises";
import { SWLogger } from "simple-wire";
import { Config } from "@/setup/config";

export class DeployService {
  constructor(
    private readonly logger: SWLogger,
    private readonly cfg: Config,
  ) {}

  // Asks the server to check GitHub for a new release now instead of at its
  // next timer tick. portifo-deploy.path sees the file change and starts the
  // root-owned deploy script, which looks up the Latest release on GitHub
  // itself. `publishedCommit` (from a signed "published" webhook) only tells
  // the script to wait a little if Latest hasn't caught up with it yet, so
  // whoever triggers this can't choose what runs. All they can do is make
  // the server look early.
  async requestDeploy(publishedCommit?: string): Promise<void> {
    await writeFile(this.cfg.DEPLOY_REQUEST_FILE, `${publishedCommit ?? ""}\n`);
    this.logger.info(`Deploy check requested${publishedCommit ? ` for ${publishedCommit.slice(0, 7)}` : ""}`);
  }
}
