import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { PinoLogger, createAsyncContextGetter } from "simple-wire";
import { AsyncLocalStorage } from "node:async_hooks";
import { ConfigSchema } from "@/setup/config";
import { createDbClient } from "@/setup/db";
import { AsyncContext } from "@/setup/async-context";
import { DrizzleIdentityRepo } from "@/domain/identity/identity.repo";
import { IdentityService } from "@/domain/identity/identity.service";
import { DrizzlePortfolioRepo } from "@/domain/portfolio/portfolio.repo";
import { PortfolioService } from "@/domain/portfolio/portfolio.service";
import { MarketService } from "@/domain/market/market.service";

// One-off import of portfolio data into a target user's default portfolio.
// Each config entry becomes exactly one account. Safe to re-run: every
// transaction is matched against existing transactions on the account by
// (type, ticker, date) and updated in place if currency/amount/notes
// drifted, or inserted if missing. Cash account balances are similarly
// idempotent (setCashAccountBalance only records a delta when it changes).
//
// Reads its (personal, git-ignored) data from seed.data.json next to this
// file — copy seed.data.example.json to get started.

const TransactionConfigSchema = z.object({
  type: z.enum(["buy", "sell", "deposit", "withdraw"]),
  date: z.string(), // ISO yyyy-mm-dd
  symbol: z.string().optional(), // omitted for deposit/withdraw
  price: z.string().optional(), // pricePerShare, omitted for deposit/withdraw
  quantity: z.string(), // shares for buy/sell, cash amount for deposit/withdraw
  comment: z.string().optional(),
});

const InvestmentAccountConfigSchema = z.object({
  type: z.literal("investment"),
  name: z.string(),
  // deposit/withdraw transactions in this account are denominated in this
  // currency; buy/sell transactions are always USD (all tickers are US-listed).
  cashTxCurrency: z.string(),
  transactions: z.array(TransactionConfigSchema),
});

const CashAccountConfigSchema = z.object({
  type: z.literal("cash"),
  name: z.string(),
  balance: z.string(),
  currency: z.string(),
});

const SeedConfigSchema = z.object({
  targetEmail: z.string(),
  targetName: z.string(),
  accounts: z.array(z.discriminatedUnion("type", [InvestmentAccountConfigSchema, CashAccountConfigSchema])),
});

type InvestmentAccountConfig = z.infer<typeof InvestmentAccountConfigSchema>;
type CashAccountConfig = z.infer<typeof CashAccountConfigSchema>;

const SEED_DATA_PATH = path.join(__dirname, "seed.data.json");

function loadSeedConfig() {
  if (!fs.existsSync(SEED_DATA_PATH)) {
    console.error(
      `Missing ${SEED_DATA_PATH}.\nCopy seed.data.example.json to seed.data.json and fill in your own data (it's git-ignored).`,
    );
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(SEED_DATA_PATH, "utf-8"));
  return SeedConfigSchema.parse(raw);
}

const seedConfig = loadSeedConfig();
const TARGET_EMAIL = seedConfig.targetEmail;
const TARGET_NAME = seedConfig.targetName;
const ACCOUNTS: Array<InvestmentAccountConfig | CashAccountConfig> = seedConfig.accounts;

async function main() {
  const cfg = ConfigSchema.parse(process.env);
  const asyncStorage = new AsyncLocalStorage<AsyncContext>();
  const logger = new PinoLogger(cfg, createAsyncContextGetter(asyncStorage));
  const db = createDbClient(cfg);

  const identityRepo = new DrizzleIdentityRepo(db);
  const identityService = new IdentityService(logger, identityRepo);
  const portfolioRepo = new DrizzlePortfolioRepo(db);
  const marketService = new MarketService(logger);
  const portfolioService = new PortfolioService(logger, portfolioRepo, marketService);

  let user = await identityService.findUserByEmail(TARGET_EMAIL);
  if (!user) {
    // No real Google ID yet — use a placeholder. AuthController.loginWithGoogle
    // adopts this row (backfilling the real googleId) the first time this
    // email actually signs in with Google, instead of erroring on the
    // duplicate email.
    user = await identityService.createUserWithDefaultPortfolio({
      googleId: `pending:${TARGET_EMAIL}`,
      email: TARGET_EMAIL,
      name: TARGET_NAME,
    });
    console.log(`Created user ${TARGET_EMAIL} with a placeholder Google ID (will link on first real Google login).`);
  }

  const portfolios = await identityService.listPortfoliosForUser(user.id);
  const portfolio = portfolios[0];
  if (!portfolio) {
    console.error(`User ${TARGET_EMAIL} has no portfolio yet — this shouldn't happen after Google sign-in.`);
    process.exit(1);
  }
  console.log(`Seeding into portfolio "${portfolio.name}" (${portfolio.id}) for ${TARGET_EMAIL}`);

  const existingAccounts = await portfolioService.listAccountsByPortfolio(portfolio.id);

  for (const cfgEntry of ACCOUNTS) {
    if (cfgEntry.type === "cash") {
      let account = existingAccounts.find((a) => a.type === "cash" && a.name === cfgEntry.name);
      if (!account) {
        account = await portfolioService.createAccount({ portfolioId: portfolio.id, name: cfgEntry.name, type: "cash" });
        existingAccounts.push(account);
      }
      await portfolioService.setCashAccountBalance(account.id, cfgEntry.currency, cfgEntry.balance);
      console.log(`  [cash] ${cfgEntry.name}: ${cfgEntry.currency} ${cfgEntry.balance}`);
      continue;
    }

    const account = await portfolioService.findOrCreateInvestmentAccount(portfolio.id, cfgEntry.name);
    const existingTxs = await portfolioService.listTransactionsByAccount(account.id);

    let inserted = 0;
    let updated = 0;
    for (const tx of cfgEntry.transactions) {
      const isCash = tx.type === "deposit" || tx.type === "withdraw";
      const ticker = isCash ? null : (tx.symbol ?? null);
      const currency = isCash ? cfgEntry.cashTxCurrency : "USD";
      const notes = tx.comment || null;
      const pricePerShare = isCash ? undefined : tx.price;

      const match = existingTxs.find((t) => t.type === tx.type && t.date === tx.date && (t.ticker ?? null) === ticker);

      if (!match) {
        await portfolioService.createTransaction({
          accountId: account.id,
          type: tx.type,
          date: tx.date,
          currency,
          amount: isCash ? tx.quantity : undefined,
          ticker: ticker ?? undefined,
          shares: isCash ? undefined : tx.quantity,
          pricePerShare,
          notes: notes ?? undefined,
        });
        inserted++;
        continue;
      }

      const needsUpdate =
        match.currency !== currency ||
        (match.notes ?? null) !== notes ||
        Number(match.amount ?? 0) !== Number(isCash ? tx.quantity : 0) ||
        Number(match.shares ?? 0) !== Number(isCash ? 0 : tx.quantity) ||
        Number(match.pricePerShare ?? 0) !== Number(isCash ? 0 : pricePerShare);
      if (!needsUpdate) continue;

      await portfolioService.updateTransaction(match.id, {
        accountId: account.id,
        type: tx.type,
        date: tx.date,
        currency,
        amount: isCash ? tx.quantity : null,
        ticker,
        shares: isCash ? null : tx.quantity,
        pricePerShare: isCash ? null : pricePerShare,
        notes,
      });
      updated++;
    }
    const unchanged = cfgEntry.transactions.length - inserted - updated;
    console.log(`  [investment] ${cfgEntry.name}: ${inserted} inserted, ${updated} updated, ${unchanged} unchanged`);
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
