import { Request, Response, Router } from "express";
import { SWController, SWLogger } from "simple-wire";
import { AuthService } from "@/domain/auth/auth.service";
import { IdentityService } from "@/domain/identity/identity.service";
import { PortfolioService } from "@/domain/portfolio/portfolio.service";
import { AccountsSelect, TransactionsSelect } from "@/domain/portfolio/portfolio.schema";
import { UsersSelect } from "@/domain/identity/identity.schema";
import { HistoryRange } from "@/domain/market/market.service";

const TRANSACTION_TYPES = ["buy", "sell", "deposit", "withdraw"] as const;
type TransactionType = (typeof TRANSACTION_TYPES)[number];

function isTransactionType(value: unknown): value is TransactionType {
  return TRANSACTION_TYPES.includes(value as TransactionType);
}

const HISTORY_RANGES = ["1D", "1W", "1M", "3M", "6M", "1Y", "2Y", "5Y", "All"] as const;

function isHistoryRange(value: unknown): value is HistoryRange {
  return HISTORY_RANGES.includes(value as HistoryRange);
}

const ACCOUNT_TYPES = ["investment", "cash"] as const;
type AccountType = (typeof ACCOUNT_TYPES)[number];

function isAccountType(value: unknown): value is AccountType {
  return ACCOUNT_TYPES.includes(value as AccountType);
}

async function toAccountDto(account: AccountsSelect, portfolioService: PortfolioService) {
  const balances = await portfolioService.listCurrencyBalancesByAccount(account.id);
  return {
    ...account,
    balances: balances
      .map((b) => ({ currency: b.currency, balance: Number(b.balance), asOf: b.updatedAt.toISOString().slice(0, 10) }))
      .filter((b) => Math.abs(b.balance) > 0.004),
  };
}

const CURRENCY_RE = /^[A-Z]{3}$/;
// Guards the X-Portfolio-Id header before it reaches a uuid column — Postgres
// errors on invalid uuid input rather than returning no rows.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toTransactionDto(transaction: TransactionsSelect, accountName: string) {
  return {
    id: transaction.id,
    type: transaction.type,
    account: accountName,
    date: transaction.date,
    currency: transaction.currency,
    amount: transaction.amount != null ? Number(transaction.amount) : undefined,
    symbol: transaction.ticker ?? undefined,
    shares: transaction.shares != null ? Number(transaction.shares) : undefined,
    pricePerShare: transaction.pricePerShare != null ? Number(transaction.pricePerShare) : undefined,
    notes: transaction.notes ?? undefined,
  };
}

export class PortfolioController implements SWController {
  constructor(
    private readonly logger: SWLogger,
    private readonly authService: AuthService,
    private readonly identityService: IdentityService,
    private readonly portfolioService: PortfolioService,
  ) {}

  public register(router: Router): void {
    router.get("/portfolios", this.listPortfolios);
    router.post("/portfolios", this.createPortfolio);
    router.get("/accounts", this.listAccounts);
    router.post("/accounts", this.createAccount);
    router.patch("/accounts/:id/balances/:currency", this.setCashBalance);
    router.get("/portfolio/history", this.getPortfolioHistory);
    router.get("/transactions", this.listTransactions);
    router.post("/transactions", this.createTransaction);
    router.patch("/transactions/:id", this.updateTransaction);
    router.delete("/transactions/:id", this.deleteTransaction);
  }

  private authenticate = async (req: Request): Promise<UsersSelect | null> => {
    const token = req.cookies?.[this.authService.cookieName];
    const session = token ? this.authService.verifySession(token) : null;
    if (!session) return null;
    const user = await this.identityService.getUserById(session.userId);
    return user ?? null;
  };

  // The client picks the active portfolio and sends it as X-Portfolio-Id;
  // membership is verified before use. A missing or invalid header falls back
  // to the user's first portfolio (e.g. right after signup, or if the
  // referenced portfolio was deleted).
  private resolvePortfolioId = async (req: Request, userId: string): Promise<string | undefined> => {
    const requested = req.header("x-portfolio-id");
    if (requested && UUID_RE.test(requested)) {
      const member = await this.identityService.findMember(userId, requested);
      if (member) return requested;
    }
    const portfolios = await this.identityService.listPortfoliosForUser(userId);
    return portfolios[0]?.id;
  };

  private listPortfolios = async (req: Request, res: Response): Promise<void> => {
    this.logger.info("PortfolioController.listPortfolios called");
    const user = await this.authenticate(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const portfolios = await this.identityService.listPortfoliosForUser(user.id);
    res.json(portfolios.map((p) => ({ id: p.id, name: p.name })));
  };

  private createPortfolio = async (req: Request, res: Response): Promise<void> => {
    this.logger.info("PortfolioController.createPortfolio called");
    const user = await this.authenticate(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) {
      res.status(400).json({ error: "Invalid portfolio payload" });
      return;
    }

    const existing = await this.identityService.listPortfoliosForUser(user.id);
    if (existing.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      res.status(400).json({ error: `A portfolio named "${name}" already exists` });
      return;
    }

    const portfolio = await this.identityService.createPortfolioForUser(user.id, name);
    res.status(201).json({ id: portfolio.id, name: portfolio.name });
  };

  private listAccounts = async (req: Request, res: Response): Promise<void> => {
    this.logger.info("PortfolioController.listAccounts called");
    const user = await this.authenticate(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const portfolioId = await this.resolvePortfolioId(req, user.id);
    const accounts = portfolioId ? await this.portfolioService.listAccountsByPortfolio(portfolioId) : [];
    const accountDtos = await Promise.all(accounts.map((account) => toAccountDto(account, this.portfolioService)));
    res.json(accountDtos);
  };

  private createAccount = async (req: Request, res: Response): Promise<void> => {
    this.logger.info("PortfolioController.createAccount called");
    const user = await this.authenticate(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const portfolioId = await this.resolvePortfolioId(req, user.id);
    if (!portfolioId) {
      res.status(400).json({ error: "No portfolio found for user" });
      return;
    }

    const body = req.body ?? {};
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const type = body.type;

    if (!name || !isAccountType(type)) {
      res.status(400).json({ error: "Invalid account payload" });
      return;
    }

    const existing = await this.portfolioService.listAccountsByPortfolio(portfolioId);
    if (existing.some((account) => account.type === type && account.name.toLowerCase() === name.toLowerCase())) {
      res.status(400).json({ error: `An account named "${name}" already exists` });
      return;
    }

    const account = await this.portfolioService.createAccount({ portfolioId, name, type });
    res.status(201).json(await toAccountDto(account, this.portfolioService));
  };

  private setCashBalance = async (req: Request, res: Response): Promise<void> => {
    this.logger.info("PortfolioController.setCashBalance called");
    const user = await this.authenticate(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const portfolioId = await this.resolvePortfolioId(req, user.id);
    if (!portfolioId) {
      res.status(400).json({ error: "No portfolio found for user" });
      return;
    }

    const accountId = String(req.params.id);
    const account = await this.portfolioService.getAccountById(accountId);
    if (!account || account.portfolioId !== portfolioId || account.type !== "cash") {
      res.status(404).json({ error: "Cash account not found" });
      return;
    }

    const currency = String(req.params.currency).toUpperCase();
    const balance = Number(req.body?.balance);
    if (!CURRENCY_RE.test(currency) || !(balance >= 0)) {
      res.status(400).json({ error: "Invalid balance payload" });
      return;
    }

    try {
      await this.portfolioService.setCashAccountBalance(accountId, currency, balance.toFixed(8));
      res.json(await toAccountDto(account, this.portfolioService));
    } catch (err) {
      this.logger.error("PortfolioController.setCashBalance failed");
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to update balance" });
    }
  };

  private getPortfolioHistory = async (req: Request, res: Response): Promise<void> => {
    this.logger.info("PortfolioController.getPortfolioHistory called");
    const user = await this.authenticate(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const portfolioId = await this.resolvePortfolioId(req, user.id);
    if (!portfolioId) {
      res.json([]);
      return;
    }

    const range = req.query.range;
    const currency = String(req.query.currency ?? "USD").toUpperCase();
    if (!isHistoryRange(range) || !CURRENCY_RE.test(currency)) {
      res.status(400).json({ error: "Invalid history query" });
      return;
    }

    try {
      res.json(await this.portfolioService.getPortfolioValueHistory(portfolioId, range, currency));
    } catch (err) {
      this.logger.error("PortfolioController.getPortfolioHistory failed");
      res.status(502).json({ error: "Failed to compute portfolio history" });
    }
  };

  private listTransactions = async (req: Request, res: Response): Promise<void> => {
    this.logger.info("PortfolioController.listTransactions called");
    const user = await this.authenticate(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const portfolioId = await this.resolvePortfolioId(req, user.id);
    if (!portfolioId) {
      res.json([]);
      return;
    }

    const accounts = await this.portfolioService.listAccountsByPortfolio(portfolioId);
    // Cash accounts carry system-generated deposit/withdraw transactions from
    // balance edits (see PortfolioService.setCashAccountBalance) that must stay
    // out of the user-facing ledger — only investment accounts are listed here.
    const investmentAccounts = accounts.filter((account) => account.type === "investment");
    const transactionsByAccount = await Promise.all(
      investmentAccounts.map((account) => this.portfolioService.listTransactionsByAccount(account.id)),
    );

    const accountNameById = new Map(accounts.map((account) => [account.id, account.name]));
    const transactions = transactionsByAccount
      .flat()
      .map((transaction) => toTransactionDto(transaction, accountNameById.get(transaction.accountId) ?? ""));
    res.json(transactions);
  };

  private parseTransactionPayload(
    body: Record<string, any>,
  ):
    | {
        ok: true;
        data: {
          accountName: string;
          type: TransactionType;
          date: string;
          currency: string;
          amount?: string;
          ticker?: string;
          shares?: string;
          pricePerShare?: string;
          notes?: string;
        };
      }
    | { ok: false; error: string } {
    const accountName = typeof body.account === "string" ? body.account.trim() : "";
    const type = body.type;
    const date = body.date;
    const currency = body.currency;

    if (!accountName || !isTransactionType(type) || typeof date !== "string" || typeof currency !== "string") {
      return { ok: false, error: "Invalid transaction payload" };
    }

    const isCashType = type === "deposit" || type === "withdraw";
    if (isCashType && !(Number(body.amount) > 0)) {
      return { ok: false, error: "amount is required" };
    }
    // pricePerShare may legitimately be 0 (e.g. RSU grants), so it's checked
    // for presence separately rather than folded into a truthy/">0" test.
    const hasPricePerShare = body.pricePerShare !== undefined && body.pricePerShare !== null && body.pricePerShare !== "";
    if (
      !isCashType &&
      !(
        typeof body.symbol === "string" &&
        body.symbol.trim() &&
        Number(body.shares) > 0 &&
        hasPricePerShare &&
        Number(body.pricePerShare) >= 0
      )
    ) {
      return { ok: false, error: "symbol, shares and pricePerShare are required" };
    }

    const notes = typeof body.notes === "string" ? body.notes.trim() : "";

    return {
      ok: true,
      data: {
        accountName,
        type,
        date,
        currency,
        amount: isCashType ? String(body.amount) : undefined,
        ticker: isCashType ? undefined : String(body.symbol).trim().toUpperCase(),
        shares: isCashType ? undefined : String(body.shares),
        pricePerShare: isCashType ? undefined : String(body.pricePerShare),
        notes: notes ? notes : undefined,
      },
    };
  }

  private createTransaction = async (req: Request, res: Response): Promise<void> => {
    this.logger.info("PortfolioController.createTransaction called");
    const user = await this.authenticate(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const portfolioId = await this.resolvePortfolioId(req, user.id);
    if (!portfolioId) {
      res.status(400).json({ error: "No portfolio found for user" });
      return;
    }

    const parsed = this.parseTransactionPayload(req.body ?? {});
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    let account: AccountsSelect;
    try {
      account = await this.portfolioService.findOrCreateInvestmentAccount(portfolioId, parsed.data.accountName);
      const transaction = await this.portfolioService.createTransaction({
        accountId: account.id,
        type: parsed.data.type,
        date: parsed.data.date,
        currency: parsed.data.currency,
        amount: parsed.data.amount,
        ticker: parsed.data.ticker,
        shares: parsed.data.shares,
        pricePerShare: parsed.data.pricePerShare,
        notes: parsed.data.notes,
      });
      res.status(201).json(toTransactionDto(transaction, account.name));
    } catch (err) {
      this.logger.error("PortfolioController.createTransaction failed");
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to create transaction" });
    }
  };

  // Confirms the transaction belongs to an account in the caller's own portfolio
  // before any update/delete touches it.
  private authorizeTransaction = async (
    portfolioId: string,
    transactionId: string,
  ): Promise<TransactionsSelect | null> => {
    const existing = await this.portfolioService.getTransactionById(transactionId);
    if (!existing) return null;
    const account = await this.portfolioService.getAccountById(existing.accountId);
    if (!account || account.portfolioId !== portfolioId) return null;
    return existing;
  };

  private updateTransaction = async (req: Request, res: Response): Promise<void> => {
    this.logger.info("PortfolioController.updateTransaction called");
    const user = await this.authenticate(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const portfolioId = await this.resolvePortfolioId(req, user.id);
    if (!portfolioId) {
      res.status(400).json({ error: "No portfolio found for user" });
      return;
    }

    const id = String(req.params.id);
    const existing = await this.authorizeTransaction(portfolioId, id);
    if (!existing) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }

    const parsed = this.parseTransactionPayload(req.body ?? {});
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    try {
      const account = await this.portfolioService.findOrCreateInvestmentAccount(portfolioId, parsed.data.accountName);
      const transaction = await this.portfolioService.updateTransaction(id, {
        accountId: account.id,
        type: parsed.data.type,
        date: parsed.data.date,
        currency: parsed.data.currency,
        amount: parsed.data.amount ?? null,
        ticker: parsed.data.ticker ?? null,
        shares: parsed.data.shares ?? null,
        pricePerShare: parsed.data.pricePerShare ?? null,
        notes: parsed.data.notes ?? null,
      });
      res.json(toTransactionDto(transaction, account.name));
    } catch (err) {
      this.logger.error("PortfolioController.updateTransaction failed");
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to update transaction" });
    }
  };

  private deleteTransaction = async (req: Request, res: Response): Promise<void> => {
    this.logger.info("PortfolioController.deleteTransaction called");
    const user = await this.authenticate(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const portfolioId = await this.resolvePortfolioId(req, user.id);
    if (!portfolioId) {
      res.status(400).json({ error: "No portfolio found for user" });
      return;
    }

    const id = String(req.params.id);
    const existing = await this.authorizeTransaction(portfolioId, id);
    if (!existing) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }

    await this.portfolioService.deleteTransaction(id);
    res.status(204).end();
  };
}
