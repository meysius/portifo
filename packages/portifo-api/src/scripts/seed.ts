import "dotenv/config";
import fs from "node:fs";
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

// One-off import of Yahoo Finance "portfolio" CSV exports into the
// me.feghhi@gmail.com user's default portfolio. Each CSV becomes exactly one
// account. Safe to re-run: every transaction row is matched against existing
// transactions on the account by (type, ticker, date) — our CSVs never repeat
// that triple within one account — and updated in place if currency/amount/
// notes drifted, or inserted if missing. Cash account balances are similarly
// idempotent (setCashAccountBalance only records a delta when it changes).
const TARGET_EMAIL = "me.feghhi@gmail.com";
const TARGET_NAME = "Meysam Feghhi";

type InvestmentAccountConfig = {
  file: string;
  name: string;
  type: "investment";
  // $$CASH_TX rows (deposits/withdrawals) in this file are denominated in
  // this currency; BUY/SELL rows are always USD (all tickers are US-listed).
  cashTxCurrency: string;
};

type CashAccountConfig = {
  file: string;
  name: string;
  type: "cash";
  balance: string;
  currency: string;
};

const ACCOUNTS: Array<InvestmentAccountConfig | CashAccountConfig> = [
  { file: "portfolio (9).csv", name: "Meysam's TFSA", type: "investment", cashTxCurrency: "USD" },
  { file: "portfolio (7).csv", name: "Haniyeh's TFSA", type: "investment", cashTxCurrency: "USD" },
  { file: "portfolio (8).csv", name: "Meysam's Margin", type: "investment", cashTxCurrency: "USD" },
  { file: "portfolio (6).csv", name: "Fidelity Account", type: "investment", cashTxCurrency: "USD" },
  { file: "portfolio (4).csv", name: "Haniyeh's RBC", type: "cash", balance: "16500", currency: "CAD" },
  { file: "portfolio (5).csv", name: "Meysam's RBC", type: "cash", balance: "13500", currency: "CAD" },
];

const CSV_DIR = `${process.env.HOME}/Downloads`;

// Overrides the CSV's market price for specific lots that weren't actually
// purchased at market price — e.g. RSU grants, recorded here at their real
// cost basis. Keyed by "account name|ticker|trade date (ISO)".
const PRICE_OVERRIDES: Record<string, string> = {
  "Fidelity Account|SHOP|2026-07-08": "0", // RSU grant, no cash paid
};

interface CsvRow {
  symbol: string;
  tradeDate: string; // YYYYMMDD
  purchasePrice: string;
  quantity: string;
  comment: string;
  transactionType: string; // BUY / SELL / DEPOSIT / WITHDRAW
}

function parseCsv(path: string): CsvRow[] {
  const lines = fs.readFileSync(path, "utf-8").split("\n").filter((l) => l.trim().length > 0);
  const [, ...rows] = lines; // drop header
  return rows.map((line) => {
    const cols = line.split(",");
    return {
      symbol: cols[0],
      tradeDate: cols[9],
      purchasePrice: cols[10],
      quantity: cols[11],
      comment: cols[15]?.trim() ?? "",
      transactionType: cols[16],
    };
  });
}

function toIsoDate(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

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
    const csvPath = `${CSV_DIR}/${cfgEntry.file}`;
    const rows = parseCsv(csvPath);

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
    for (const row of rows) {
      const type = row.transactionType.trim().toLowerCase();
      if (type !== "buy" && type !== "sell" && type !== "deposit" && type !== "withdraw") continue;

      const isCash = type === "deposit" || type === "withdraw";
      const date = toIsoDate(row.tradeDate);
      const ticker = isCash ? null : row.symbol;
      const currency = isCash ? cfgEntry.cashTxCurrency : "USD";
      const notes = row.comment || null;
      const pricePerShare = isCash ? undefined : (PRICE_OVERRIDES[`${cfgEntry.name}|${ticker}|${date}`] ?? row.purchasePrice);

      const match = existingTxs.find((t) => t.type === type && t.date === date && (t.ticker ?? null) === ticker);

      if (!match) {
        await portfolioService.createTransaction({
          accountId: account.id,
          type,
          date,
          currency,
          amount: isCash ? row.quantity : undefined,
          ticker: ticker ?? undefined,
          shares: isCash ? undefined : row.quantity,
          pricePerShare,
          notes: notes ?? undefined,
        });
        inserted++;
        continue;
      }

      const needsUpdate =
        match.currency !== currency ||
        (match.notes ?? null) !== notes ||
        Number(match.amount ?? 0) !== Number(isCash ? row.quantity : 0) ||
        Number(match.shares ?? 0) !== Number(isCash ? 0 : row.quantity) ||
        Number(match.pricePerShare ?? 0) !== Number(isCash ? 0 : pricePerShare);
      if (!needsUpdate) continue;

      await portfolioService.updateTransaction(match.id, {
        accountId: account.id,
        type,
        date,
        currency,
        amount: isCash ? row.quantity : null,
        ticker,
        shares: isCash ? null : row.quantity,
        pricePerShare: isCash ? null : pricePerShare,
        notes,
      });
      updated++;
    }
    console.log(`  [investment] ${cfgEntry.name}: ${inserted} inserted, ${updated} updated, ${rows.length - inserted - updated} unchanged`);
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
