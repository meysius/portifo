import { SWLogger } from "simple-wire";
import { IdentityRepo, MemberWithUser } from "./identity.repo";
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
    return this.identityRepo.createUser(userData);
  }

  async createUserWithDefaultPortfolio(userData: UsersInsert): Promise<UsersSelect> {
    return this.identityRepo.createUserWithDefaultPortfolio(userData);
  }

  async findUserByGoogleId(googleId: string): Promise<UsersSelect | undefined> {
    return this.identityRepo.findUserByGoogleId(googleId);
  }

  async findUserByEmail(email: string): Promise<UsersSelect | undefined> {
    return this.identityRepo.findUserByEmail(email);
  }

  async updateUserGoogleId(id: string, googleId: string): Promise<UsersSelect> {
    return this.identityRepo.updateUserGoogleId(id, googleId);
  }

  async getUserById(id: string): Promise<UsersSelect | undefined> {
    return this.identityRepo.getUserById(id);
  }

  async listAllUsers(): Promise<UsersSelect[]> {
    return this.identityRepo.listAllUsers();
  }

  async createPortfolio(portfolioData: PortfoliosInsert): Promise<PortfoliosSelect> {
    return this.identityRepo.createPortfolio(portfolioData);
  }

  async createPortfolioForUser(userId: string, name: string, email: string): Promise<PortfoliosSelect> {
    return this.identityRepo.createPortfolioForUser(userId, name, email);
  }

  async getPortfolioById(id: string): Promise<PortfoliosSelect | undefined> {
    return this.identityRepo.getPortfolioById(id);
  }

  async listPortfoliosForUser(userId: string): Promise<PortfoliosSelect[]> {
    return this.identityRepo.listPortfoliosForUser(userId);
  }

  async updatePortfolioName(id: string, name: string): Promise<PortfoliosSelect> {
    return this.identityRepo.updatePortfolioName(id, name);
  }

  async deletePortfolio(id: string): Promise<void> {
    return this.identityRepo.deletePortfolio(id);
  }

  async createMember(memberData: MembersInsert): Promise<MembersSelect> {
    return this.identityRepo.createMember(memberData);
  }

  async listMembersByPortfolio(portfolioId: string): Promise<MemberWithUser[]> {
    return this.identityRepo.listMembersByPortfolio(portfolioId);
  }

  async findMember(userId: string, portfolioId: string): Promise<MembersSelect | undefined> {
    return this.identityRepo.findMember(userId, portfolioId);
  }

  async findMemberById(id: string): Promise<MembersSelect | undefined> {
    return this.identityRepo.findMemberById(id);
  }

  async findMemberByEmail(email: string, portfolioId: string): Promise<MembersSelect | undefined> {
    return this.identityRepo.findMemberByEmail(email, portfolioId);
  }

  async updateMemberRole(id: string, role: MembersSelect["role"]): Promise<MembersSelect> {
    return this.identityRepo.updateMemberRole(id, role);
  }

  async removeMember(id: string): Promise<void> {
    return this.identityRepo.removeMember(id);
  }

  async activatePendingMembers(userId: string, email: string): Promise<void> {
    return this.identityRepo.activatePendingMembers(userId, email);
  }
}
