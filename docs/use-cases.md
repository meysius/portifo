When a **User** first opens the app, they see a "login with Google" button.
User should stay logged in until they explicitly log out.

on their first login, they see an empty **Portfolio** is created for them with name **My Portfolio**.

### Onboarding

Whenever the active portfolio doesn't yet have both an Investment Account and a Cash Account, the user does not see the usual bottom app navigation. Instead they go through a 2-step **Onboarding** flow that explains how Portifo works and sets up their first Investment Account and first Cash Account. There is no separate "onboarded" flag — this is purely a function of which account types the active portfolio has, so it also applies the same way to any new portfolio a user creates later (see **Settings** tab), not just their very first one. (The gate checks both account types rather than "has any account," since checking only that would satisfy itself the moment Step 1 creates the Investment Account and skip Step 2 entirely.)

**Step 1 — Investment Account.** The screen explains that an Investment Account is where the user buys and sells investments, and that its balance and holdings are kept automatically up to date from the transactions recorded on it — this is how the user can tell how much money they've deposited into the account (important context for e.g. a Canadian TFSA account, where the deposited amount itself matters for contribution room). The user then enters a name, which creates their first Investment Account.

**Step 2 — Cash Account.** The screen explains that Portifo also tracks cash holdings separately via Cash Accounts, and that — to keep the user from having to record every small cash movement as a transaction — a Cash Account's balances are only ever set directly by updating a balance, never derived from transactions, and it can hold a separate balance for each currency. The user then enters a name, which creates their first Cash Account.

Once both steps are complete, the user is taken to the app's usual navigation, where they can hop between the 4 tabs: **Portfolio**, **Transactions**, **Accounts**, and **Settings**.

Even after onboarding, the **Portfolio**, **Transactions**, and **Accounts** tabs each show only an empty state until the portfolio has at least one of:
- a transaction recorded on an Investment Account, or
- a currency balance added on a Cash Account.

(The two accounts created during onboarding exist by this point, but with nothing recorded on them yet, so all three tabs stay in their empty state — the Accounts tab included — until the user's first real transaction or balance.) Once either happens, all three tabs switch to their normal content.

The **Portfolio** tab's empty state has a CTA to **Add their first Transaction**, which takes the user to the **Add Transaction** screen, with the Account field pre-filled with the Investment Account created during onboarding.

A transaction has one of these types: **Buy**, **Sell**, **Deposit**, **Withdraw**.
A transaction belongs to an Investment Account.

The Account field lets the user select from a list of their existing Investment Accounts, or type a new name to create another one.

Transaction also has a date.

if the transaction is a Deposit or Withdraw, user has to enter an amount and a currency.

Note: Accounts will have separate balances for each currency so currencies are not mixed or converted by default.

If the transaction is a Buy or Sell, user has to enter a ticker symbol, number of shares, and price per share.
(price per share includes an amount and a currency)

After the first transaction is added, the user is taken to the apps main screen called "Holdings".

(Holdings page shows total values in a default currency, settable at the top of the page)
This screen has 3 sections:
1. **Total Portfolio Value**: total value of all holdings in the portfolio, converted to the user's preferred currency.
2. **Allocation**: a horizontal partition line chart showing the allocation of the portfolio to total cash and each individual stock holdings.
  cash includes all cash balances in all currencies, converted to the user's preferred currency for this page.
    uses real-time FX rates to convert currencies.
3. **Holdings**: a list of all holdings in the portfolio.
  the first holdings item is always **Cash** which shows the total cash balance in the portfolio, converted to the user's preferred currency.
  this list includes all holdings in the portfolio, including open and closed holdings.
  A closed holding is one where the user has sold all shares of that stock. Closed holdings are shown at the very bottom of the list, and are visually distinguished from open holdings.

When user taps on an item in the holdings list, they are taken to a **Holding Detail** screen for that holding.
The following information is shown on the Holding Detail screen if the holding is a stock holding:
Symbol, number of shares (sum of all shares from all lots of this stock user has), Average age, average cost per share, total market value, unrealized P&L ($ and %), and a chart showing the price history of the stock plus which accounts are they being held in, for each account, the number of shares and avg cost per share for that account.


A + button at the top of the holdings page allows the user to add a new holding.
when clicked, user can select whether they want to add a stock holding or a cash holding.
if they select stock, they are taken to the **Add Transaction** screen with the transaction type set to Buy, and the Account field pre-filled with the first Investment Account they created.
if they select cash, they are prompted to select a cash holding account. (they are able to enter the name, or select from a list of existing cash accounts). After selecting the cash account, they are taken to the Cash holdings screen for that account, where they can see all cash holdings previously entered in that account (each for a different currency). Note that cash holding accounts have separate balances for each currency, so currencies are not mixed or converted by default.

Once the user is past Onboarding (i.e. the active portfolio has at least one Account), the app displays a navigation bar at the bottom of the screen with 4 tabs:
1. **Holdings**: the main screen described above.
2. **Transactions**: a list of all transactions in the portfolio.
3. **Accounts**: a list of all accounts in the portfolio, including Investment Accounts and Cash Accounts.
4. **Settings**: a screen where the user can see what user account have they logged in as, which portfolio is currently active (switch to another or add a new one), manage portfolio members, active theme (dark, light) and a button to log out.

When user taps on a transaction in the **Transactions** tab, they are taken to a **Transaction Detail** screen for that transaction. This screen is read-only, so opening a transaction to look at it can never accidentally change it. It shows the account it belongs to, the date, the type (Buy, Sell, Deposit, Withdraw), and depending on type, the ticker symbol + number of shares + price per share (Buy/Sell) or the amount + currency (Deposit/Withdraw). An explicit **Edit** action on this screen takes the user to the existing Add/Edit Transaction screen, pre-filled with the transaction's current values.

When user taps on an account in the **Accounts** tab, they are taken to an **Account Detail** screen for that account. What it shows depends on the account's type:
- For an **Investment Account**: the account's total value (its stock holdings plus any cash held directly in the account, converted to the user's preferred currency), a **Holdings** list of the stock holdings held in that account, and a **Cash** list of the account's per-currency balances (built up from Deposit/Withdraw transactions on that account).
- For a **Cash Account**: the account's total value (all of its currency balances converted to the user's preferred currency), and a list of its per-currency balances. A Cash Account has no stock holdings.

On a **Cash Account**, tapping a currency balance opens the **Update Balance** screen for that currency, where the user can enter a new balance and save it (or delete the balance, equivalent to setting it to zero). A **+** button next to the Currency Balances list opens the same Update Balance screen with no currency preselected, letting the user pick a currency the account doesn't have a balance in yet and set its starting balance.

An **Investment Account**'s Cash rows are not editable this way, since they're a running total the app keeps in sync from that account's own Deposit/Withdraw transactions, not a value the user sets directly — those rows have no **+** button and don't open anything when tapped.


Domain Models:
User: has a name, email, can login using google.
Member: User can be a member of multiple portfolios, and can have different roles in each portfolio (Viewer, Editor, Owner). member has a user_id, portfolio_id, role.
Portfolio: has a name, has many members, has many accounts, has many transactions.
Account: has a name, belongs to a portfolio, is either investment or cash holding.
CurrencyBalance: belongs to an account in a portfolio, has a currency, has a balance. An account may have at most one CurrencyBalance per currency.
Transaction: belongs to an investment account in a portfolio, has a type (Buy, Sell, Deposit, Withdraw), has a date, currency, has an amount (for Deposit and Withdraw), has a ticker symbol, number of shares, price per share (for Buy and Sell).

for getting the latest fx rates and symbol quotes we will use yahoo-finance2 npm package. so no need to store them.


Domain slices:

identity slice:
  Tables: users, portfolios, members

portfolio slice:
  Tables: accounts, currency_balances, transactions
