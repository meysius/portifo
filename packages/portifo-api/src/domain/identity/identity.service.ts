import { SWLogger } from "simple-wire";
import { IdentityRepo } from "./identity.repo";
import {
  UsersSelect,
  UsersInsert,
  PortfoliosSelect,
  PortfoliosInsert,
  MembersSelect,
  MembersInsert,
} from "./identity.schema";

export class IdentityService {
  constructor(
    private readonly logger: SWLogger,
    private readonly identityRepo: IdentityRepo,
  ) {}

  async createUser(userData: UsersInsert): Promise<UsersSelect> {
    this.logger.info("IdentityService.createUser called");
    return this.identityRepo.createUser(userData);
  }

  async createUserWithDefaultPortfolio(userData: UsersInsert): Promise<UsersSelect> {
    this.logger.info("IdentityService.createUserWithDefaultPortfolio called");
    return this.identityRepo.createUserWithDefaultPortfolio(userData);
  }

  async findUserByGoogleId(googleId: string): Promise<UsersSelect | undefined> {
    this.logger.info("IdentityService.findUserByGoogleId called");
    return this.identityRepo.findUserByGoogleId(googleId);
  }

  async findUserByEmail(email: string): Promise<UsersSelect | undefined> {
    this.logger.info("IdentityService.findUserByEmail called");
    return this.identityRepo.findUserByEmail(email);
  }

  async updateUserGoogleId(id: string, googleId: string): Promise<UsersSelect> {
    this.logger.info("IdentityService.updateUserGoogleId called");
    return this.identityRepo.updateUserGoogleId(id, googleId);
  }

  async getUserById(id: string): Promise<UsersSelect | undefined> {
    this.logger.info("IdentityService.getUserById called");
    return this.identityRepo.getUserById(id);
  }

  async listAllUsers(): Promise<UsersSelect[]> {
    this.logger.info("IdentityService.listAllUsers called");
    return this.identityRepo.listAllUsers();
  }

  async createPortfolio(portfolioData: PortfoliosInsert): Promise<PortfoliosSelect> {
    this.logger.info("IdentityService.createPortfolio called");
    return this.identityRepo.createPortfolio(portfolioData);
  }

  async createPortfolioForUser(userId: string, name: string): Promise<PortfoliosSelect> {
    this.logger.info("IdentityService.createPortfolioForUser called");
    return this.identityRepo.createPortfolioForUser(userId, name);
  }

  async getPortfolioById(id: string): Promise<PortfoliosSelect | undefined> {
    this.logger.info("IdentityService.getPortfolioById called");
    return this.identityRepo.getPortfolioById(id);
  }

  async listPortfoliosForUser(userId: string): Promise<PortfoliosSelect[]> {
    this.logger.info("IdentityService.listPortfoliosForUser called");
    return this.identityRepo.listPortfoliosForUser(userId);
  }

  async createMember(memberData: MembersInsert): Promise<MembersSelect> {
    this.logger.info("IdentityService.createMember called");
    return this.identityRepo.createMember(memberData);
  }

  async listMembersByPortfolio(portfolioId: string): Promise<MembersSelect[]> {
    this.logger.info("IdentityService.listMembersByPortfolio called");
    return this.identityRepo.listMembersByPortfolio(portfolioId);
  }

  async findMember(userId: string, portfolioId: string): Promise<MembersSelect | undefined> {
    this.logger.info("IdentityService.findMember called");
    return this.identityRepo.findMember(userId, portfolioId);
  }

  async removeMember(id: string): Promise<void> {
    this.logger.info("IdentityService.removeMember called");
    return this.identityRepo.removeMember(id);
  }
}
