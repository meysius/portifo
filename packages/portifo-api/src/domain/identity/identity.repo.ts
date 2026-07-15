import { eq, and, isNull } from "drizzle-orm";
import { DrizzleDb } from "@/setup/db";
import {
  users,
  portfolios,
  members,
  UsersInsert,
  UsersSelect,
  PortfoliosInsert,
  PortfoliosSelect,
  MembersInsert,
  MembersSelect,
} from "./identity.schema";

// A member row joined with the linked user's display name — null when the
// row is Pending (added by email, that address hasn't signed in yet).
export type MemberWithUser = MembersSelect & { name: string | null };

export interface IdentityRepo {
  createUser(userData: UsersInsert): Promise<UsersSelect>;
  createUserWithDefaultPortfolio(userData: UsersInsert): Promise<UsersSelect>;
  findUserByGoogleId(googleId: string): Promise<UsersSelect | undefined>;
  findUserByEmail(email: string): Promise<UsersSelect | undefined>;
  updateUserGoogleId(id: string, googleId: string): Promise<UsersSelect>;
  getUserById(id: string): Promise<UsersSelect | undefined>;
  listAllUsers(): Promise<UsersSelect[]>;

  createPortfolio(portfolioData: PortfoliosInsert): Promise<PortfoliosSelect>;
  createPortfolioForUser(userId: string, name: string, email: string): Promise<PortfoliosSelect>;
  getPortfolioById(id: string): Promise<PortfoliosSelect | undefined>;
  listPortfoliosForUser(userId: string): Promise<PortfoliosSelect[]>;
  updatePortfolioName(id: string, name: string): Promise<PortfoliosSelect>;
  deletePortfolio(id: string): Promise<void>;

  createMember(memberData: MembersInsert): Promise<MembersSelect>;
  listMembersByPortfolio(portfolioId: string): Promise<MemberWithUser[]>;
  findMember(userId: string, portfolioId: string): Promise<MembersSelect | undefined>;
  findMemberById(id: string): Promise<MembersSelect | undefined>;
  findMemberByEmail(email: string, portfolioId: string): Promise<MembersSelect | undefined>;
  updateMemberRole(id: string, role: MembersSelect["role"]): Promise<MembersSelect>;
  removeMember(id: string): Promise<void>;
  // Attaches userId to any Pending rows (userId IS NULL) matching this email
  // across every portfolio — called on every login, see AuthController.
  activatePendingMembers(userId: string, email: string): Promise<void>;
}

export class DrizzleIdentityRepo implements IdentityRepo {
  constructor(private readonly db: DrizzleDb) {}

  async createUser(userData: UsersInsert): Promise<UsersSelect> {
    const result = await this.db.insert(users).values(userData).returning();
    return result[0];
  }

  async createUserWithDefaultPortfolio(userData: UsersInsert): Promise<UsersSelect> {
    return this.db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values(userData).returning();
      const [portfolio] = await tx.insert(portfolios).values({ name: "My Portfolio" }).returning();
      await tx.insert(members).values({
        userId: user.id,
        email: user.email,
        portfolioId: portfolio.id,
        role: "owner",
      });
      return user;
    });
  }

  async findUserByGoogleId(googleId: string): Promise<UsersSelect | undefined> {
    const result = await this.db.select().from(users).where(eq(users.googleId, googleId));
    return result[0];
  }

  async findUserByEmail(email: string): Promise<UsersSelect | undefined> {
    const result = await this.db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async updateUserGoogleId(id: string, googleId: string): Promise<UsersSelect> {
    const result = await this.db.update(users).set({ googleId }).where(eq(users.id, id)).returning();
    return result[0];
  }

  async getUserById(id: string): Promise<UsersSelect | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async listAllUsers(): Promise<UsersSelect[]> {
    return this.db.select().from(users);
  }

  async createPortfolio(portfolioData: PortfoliosInsert): Promise<PortfoliosSelect> {
    const result = await this.db.insert(portfolios).values(portfolioData).returning();
    return result[0];
  }

  async createPortfolioForUser(userId: string, name: string, email: string): Promise<PortfoliosSelect> {
    return this.db.transaction(async (tx) => {
      const [portfolio] = await tx.insert(portfolios).values({ name }).returning();
      await tx.insert(members).values({
        userId,
        email,
        portfolioId: portfolio.id,
        role: "owner",
      });
      return portfolio;
    });
  }

  async getPortfolioById(id: string): Promise<PortfoliosSelect | undefined> {
    const result = await this.db.select().from(portfolios).where(eq(portfolios.id, id));
    return result[0];
  }

  async listPortfoliosForUser(userId: string): Promise<PortfoliosSelect[]> {
    const rows = await this.db
      .select({ portfolio: portfolios })
      .from(members)
      .innerJoin(portfolios, eq(members.portfolioId, portfolios.id))
      .where(eq(members.userId, userId));
    return rows.map((row) => row.portfolio);
  }

  async updatePortfolioName(id: string, name: string): Promise<PortfoliosSelect> {
    const result = await this.db.update(portfolios).set({ name }).where(eq(portfolios.id, id)).returning();
    return result[0];
  }

  async deletePortfolio(id: string): Promise<void> {
    await this.db.delete(portfolios).where(eq(portfolios.id, id));
  }

  async createMember(memberData: MembersInsert): Promise<MembersSelect> {
    const result = await this.db.insert(members).values(memberData).returning();
    return result[0];
  }

  async listMembersByPortfolio(portfolioId: string): Promise<MemberWithUser[]> {
    const rows = await this.db
      .select({ member: members, name: users.name })
      .from(members)
      .leftJoin(users, eq(members.userId, users.id))
      .where(eq(members.portfolioId, portfolioId));
    return rows.map((row) => ({ ...row.member, name: row.name ?? null }));
  }

  async findMember(userId: string, portfolioId: string): Promise<MembersSelect | undefined> {
    const result = await this.db
      .select()
      .from(members)
      .where(and(eq(members.userId, userId), eq(members.portfolioId, portfolioId)));
    return result[0];
  }

  async findMemberById(id: string): Promise<MembersSelect | undefined> {
    const result = await this.db.select().from(members).where(eq(members.id, id));
    return result[0];
  }

  async findMemberByEmail(email: string, portfolioId: string): Promise<MembersSelect | undefined> {
    const result = await this.db
      .select()
      .from(members)
      .where(and(eq(members.email, email), eq(members.portfolioId, portfolioId)));
    return result[0];
  }

  async updateMemberRole(id: string, role: MembersSelect["role"]): Promise<MembersSelect> {
    const result = await this.db.update(members).set({ role }).where(eq(members.id, id)).returning();
    return result[0];
  }

  async removeMember(id: string): Promise<void> {
    await this.db.delete(members).where(eq(members.id, id));
  }

  async activatePendingMembers(userId: string, email: string): Promise<void> {
    await this.db
      .update(members)
      .set({ userId })
      .where(and(eq(members.email, email), isNull(members.userId)));
  }
}
