-- UI-verification fixture. Idempotent: re-run after any DB reset with
--   source packages/portifo-api/.env && psql "$DATABASE_URL" -f .claude/skills/verify/fixture.sql
--
-- Creates ui-verify@example.com with a portfolio that exercises the cases the
-- screens are specified against: a holding in TWO accounts (Holding Detail's
-- Accounts section), a partially-sold position (the Realized line), a
-- single-account holding, a closed position, cash in two currencies, and
-- balance-update rows (what "Set balance" writes) next to plain transfers.
-- Never verify against me.feghhi@gmail.com — that is the real account.

BEGIN;

DELETE FROM users WHERE email = 'ui-verify@example.com';
DELETE FROM portfolios WHERE name = 'UI Verify';

WITH u AS (
  INSERT INTO users ("googleId", email, name)
  VALUES ('ui-verify-fixture', 'ui-verify@example.com', 'UI Verify')
  RETURNING id
), p AS (
  INSERT INTO portfolios (name) VALUES ('UI Verify') RETURNING id
), m AS (
  INSERT INTO members ("userId", "portfolioId", role, email)
  SELECT u.id, p.id, 'owner', 'ui-verify@example.com' FROM u, p
), a AS (
  INSERT INTO accounts ("portfolioId", name)
  SELECT p.id, v.name
  FROM p, (VALUES ('Fidelity Brokerage'), ('Wealthsimple TFSA'), ('Chequing')) AS v(name)
  RETURNING id, name
)
INSERT INTO transactions ("accountId", type, date, currency, amount, ticker, shares, "pricePerShare", notes, "fromBalanceUpdate")
SELECT a.id, t.type::transaction_type, t.date::date, t.currency, t.amount, t.ticker, t.shares, t.price,
  CASE WHEN t.balance_update THEN 'Balance updated to ' || to_char(t.amount, 'FM999,999,999,990.00') || ' ' || t.currency END,
  t.balance_update
FROM a JOIN (VALUES
  -- NVDA held in two accounts, with a partial sale -> Accounts section + Realized line
  ('Fidelity Brokerage', 'buy',      '2021-03-15', 'USD', NULL,     'NVDA', 200,  13.55, false),
  ('Fidelity Brokerage', 'sell',     '2024-06-10', 'USD', NULL,     'NVDA',  40,  118.05, false),
  ('Wealthsimple TFSA',  'buy',      '2022-08-02', 'USD', NULL,     'NVDA', 103,  43.10, false),
  -- single-account holding
  ('Fidelity Brokerage', 'buy',      '2023-01-09', 'USD', NULL,     'AAPL',  60,  130.20, false),
  -- fully closed position -> the closed-position screen
  ('Fidelity Brokerage', 'buy',      '2022-02-14', 'USD', NULL,     'TSLA',  25,  290.00, false),
  ('Fidelity Brokerage', 'sell',     '2023-11-20', 'USD', NULL,     'TSLA',  25,  235.60, false),
  -- fractional shares -> the "0.4521 sh @ ..." case on the Transactions row
  ('Wealthsimple TFSA',  'buy',      '2024-03-04', 'USD', NULL,     'IBIT', 3.4521, 52.18, false),
  -- cash, two currencies, both set through "Set balance"
  ('Chequing',           'deposit',  '2024-01-05', 'USD', 12400.00, NULL,   NULL, NULL, true),
  ('Chequing',           'deposit',  '2024-02-11', 'CAD',  8300.00, NULL,   NULL, NULL, true),
  ('Fidelity Brokerage', 'deposit',  '2021-03-01', 'USD',  3000.00, NULL,   NULL, NULL, false),
  -- The withdraw makes all FOUR transaction types present so every .tx-tag
  -- colour renders on the Transactions screen.
  ('Fidelity Brokerage', 'withdraw', '2024-04-22', 'USD',  1250.00, NULL,   NULL, NULL, false)
) AS t(account, type, date, currency, amount, ticker, shares, price, balance_update)
  ON t.account = a.name;

-- Stored balances = the ledger's running cash, as the app keeps them. Fidelity
-- comes out negative (its buys outrun its deposits), the drift "Set balance"
-- exists to fix.
INSERT INTO currency_balances ("accountId", currency, balance)
SELECT t."accountId", t.currency, sum(CASE t.type
  WHEN 'deposit' THEN t.amount
  WHEN 'withdraw' THEN -t.amount
  WHEN 'sell' THEN t.shares * t."pricePerShare"
  ELSE -t.shares * t."pricePerShare" END)
FROM transactions t JOIN accounts a ON a.id = t."accountId"
JOIN portfolios p ON p.id = a."portfolioId" AND p.name = 'UI Verify'
GROUP BY t."accountId", t.currency;

COMMIT;

SELECT id, email FROM users WHERE email = 'ui-verify@example.com';
