When a **User** first opens the app, they see a "login with Google" button.
User should stay logged in until they explicitly log out.

on their first login, they see an empty **Portfolio** is created for them with name **My Portfolio**.

### Onboarding

Whenever the active portfolio doesn't yet have an Account, the user does not see the usual bottom app navigation. Instead they see a one-step **Onboarding** screen: **name your first account**. It explains that an account is wherever the user's money sits (a brokerage, a TFSA, a chequing account), and that every account can hold shares and cash in any currency. Entering a name creates the account. There is no separate "onboarded" flag — this is purely a function of whether the active portfolio has any account, so it also applies the same way to any new portfolio a user creates later (see **Settings** tab), not just their very first one.

There is only one kind of account. Any account can hold stock holdings and per-currency cash balances; there are no separate Investment and Cash accounts.

Once the account is created, the user is taken to the app's usual navigation, where they can hop between the 4 tabs: **Portfolio**, **Transactions**, **Accounts**, and **Settings**.

Even after onboarding, the **Portfolio**, **Transactions**, and **Accounts** tabs each show only an empty state until the portfolio has at least one transaction or one currency balance. (The account created during onboarding exists by this point, but with nothing recorded on it yet, so all three tabs stay in their empty state — the Accounts tab included — until the user's first real transaction or balance.) Once either happens, all three tabs switch to their normal content.

The **Portfolio** tab's empty state has a CTA to **Add their first Transaction**, which takes the user to the **Add Transaction** wizard. While the portfolio has only one account, the wizard skips the account question.

A transaction has one of these types: **Buy**, **Sell**, **Deposit**, **Withdraw**.
A transaction belongs to an Account.

The Account field lets the user select from a list of their existing Accounts, or type a new name to create another one.

The **Add Transaction** wizard's first question offers three choices: **Buy**, **Sell**, and **Cash**. Cash leads (after the account) to a screen with a three-way switch:
- **Deposit**: an amount and a date.
- **Withdraw**: an amount and a date.
- **Set balance**: shows the account's current balance in the chosen currency, and the user types what it is now.

A **balance update** is saved as a plain Deposit or Withdraw for the difference, dated today, with an auto-filled note (e.g. "Balance updated to 1,050.00 CAD") and a hidden marker so a future "total contributed" figure can tell it apart from the user's own deposits. These rows show in the Transactions list like any other. A second balance update on the same account, currency and day overwrites the first instead of adding another row.

Trade-offs of balance updates:
- A balance update is always as of today. Getting the value history right for past dates needs dated Deposits/Withdraws instead.
- Adding a backdated transaction after a balance update moves the current balance away from the figure the user set.
- Because balance updates are deposits/withdraws, the app does not currently show "how much you've deposited" into an account; the marker leaves room to compute that later.

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


A + button at the top of the holdings page opens the **Add Transaction** wizard (Buy, Sell, or Cash).

Once the user is past Onboarding (i.e. the active portfolio has at least one Account), the app displays a navigation bar at the bottom of the screen with 4 tabs:
1. **Holdings**: the main screen described above.
2. **Transactions**: a list of all transactions in the portfolio.
3. **Accounts**: one list of all accounts in the portfolio, with no grouping by type.
4. **Settings**: a screen where the user can see what user account have they logged in as, which portfolio is currently active (switch to another or add a new one), manage portfolio members, active theme (dark, light) and a button to log out.

When user taps on a transaction in the **Transactions** tab, they are taken to a **Transaction Detail** screen for that transaction. This screen is read-only, so opening a transaction to look at it can never accidentally change it. It shows the account it belongs to, the date, the type (Buy, Sell, Deposit, Withdraw), and depending on type, the ticker symbol + number of shares + price per share (Buy/Sell) or the amount + currency (Deposit/Withdraw). An explicit **Edit** action on this screen takes the user to the existing Add/Edit Transaction screen, pre-filled with the transaction's current values.

When user taps on an account in the **Accounts** tab, they are taken to an **Account Detail** screen for that account. It shows the account's total value (its stock holdings plus its cash, converted to the user's preferred currency), a **Holdings** list of the stock holdings held in that account, and a **Cash** list of the account's per-currency balances.

Tapping a cash row opens the wizard's **Cash** screen for that account and currency with **Set balance** preselected. A **+** button next to the Cash list opens the same screen with no currency preselected, for a currency the account doesn't hold yet. Setting a balance to zero removes that currency from the list.
