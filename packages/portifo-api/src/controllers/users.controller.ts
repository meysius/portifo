import { Request, Response, Router } from "express";
import { SWController, SWLogger } from "simple-wire";
import { IdentityService } from "@/domain/identity/identity.service";

export class UsersController implements SWController {
  constructor(
    private readonly logger: SWLogger,
    private readonly identityService: IdentityService,
  ) {}

  public register(router: Router): void {
    router.post("/users", this.createUser);
    router.get("/users", this.listUsers);
  }

  private listUsers = async (_req: Request, res: Response): Promise<void> => {
    this.logger.info("UsersController.listUsers called");
    const users = await this.identityService.listAllUsers();
    res.json(users);
  };

  private createUser = async (req: Request, res: Response): Promise<void> => {
    this.logger.info("UsersController.createUser called");
    await this.identityService.createUser(req.body);
    res.status(201).send();
  };
}
