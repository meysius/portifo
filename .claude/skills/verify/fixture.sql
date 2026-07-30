-- UI-verification fixture. Idempotent: re-run after any DB reset with
--   source packages/portifo-api/.env && psql "$DATABASE_URL" -f .claude/skills/verify/fixture.sql
--
-- Creates ui-verify@example.com with a portfolio that exercises the cases the
-- screens are specified against: a holding in TWO accounts (Holding Detail's
-- Accounts section), a partially-sold position (the Realized line), a
-- single-account holding, a closed position, and cash in two currencies.
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
  INSERT INTO accounts ("portfolioId", name, type)
  SELECT p.id, v.name, v.type::account_type
  FROM p, (VALUES
    ('Fidelity Brokerage', 'investment'),
    ('Wealthsimple TFSA',  'investment'),
    ('Chequing',           'cash')
  ) AS v(name, type)
  RETURNING id, name
)
INSERT INTO transactions ("accountId", type, date, currency, amount, ticker, shares, "pricePerShare")
SELECT a.id, t.type::transaction_type, t.date::date, t.currency, t.amount, t.ticker, t.shares, t.price
FROM a JOIN (VALUES
  -- NVDA held in two accounts, with a partial sale -> Accounts section + Realized line
  ('Fidelity Brokerage', 'buy',      '2021-03-15', 'USD', NULL,     'NVDA', 200,  13.55),
  ('Fidelity Brokerage', 'sell',     '2024-06-10', 'USD', NULL,     'NVDA',  40,  118.05),
  ('Wealthsimple TFSA',  'buy',      '2022-08-02', 'USD', NULL,     'NVDA', 103,  43.10),
  -- single-account holding
  ('Fidelity Brokerage', 'buy',      '2023-01-09', 'USD', NULL,     'AAPL',  60,  130.20),
  -- fully closed position -> the closed-position screen
  ('Fidelity Brokerage', 'buy',      '2022-02-14', 'USD', NULL,     'TSLA',  25,  290.00),
  ('Fidelity Brokerage', 'sell',     '2023-11-20', 'USD', NULL,     'TSLA',  25,  235.60),
  -- fractional shares -> the "0.4521 sh @ ..." case on the Transactions row
  ('Wealthsimple TFSA',  'buy',      '2024-03-04', 'USD', NULL,     'IBIT', 3.4521, 52.18),
  -- cash, two currencies
  ('Chequing',           'deposit',  '2024-01-05', 'USD', 12400.00, NULL,   NULL, NULL),
  ('Chequing',           'deposit',  '2024-02-11', 'CAD',  8300.00, NULL,   NULL, NULL),
  ('Fidelity Brokerage', 'deposit',  '2021-03-01', 'USD',  3000.00, NULL,   NULL, NULL),
  -- The withdraw makes all FOUR transaction types present so every .tx-tag
  -- colour renders on the Transactions screen. It has to sit on an INVESTMENT
  -- account: cash-account transactions are deliberately filtered out of
  -- listTransactions (portfolio.service.ts), so one on Chequing never appears.
  ('Fidelity Brokerage', 'withdraw', '2024-04-22', 'USD',  1250.00, NULL,   NULL, NULL)
) AS t(account, type, date, currency, amount, ticker, shares, price)
  ON t.account = a.name;

COMMIT;

SELECT id, email FROM users WHERE email = 'ui-verify@example.com';
