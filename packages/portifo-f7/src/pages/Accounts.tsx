import { Navbar, Page, useStore } from "framework7-react";
import { store } from "../store.ts";
import type { AccountDto } from "../api/accounts";
import { CashGlyph, InvestmentGlyph } from "../components/Glyphs.tsx";

// The Accounts tab: every Investment and Cash account in the portfolio.
// Reads the same store.accounts the onboarding gate and Holdings placeholder
// already use, so it's always in sync with them. Tapping a row will open
// the (not yet built) Account Detail screen.
export default function AccountsPage() {
  const accounts = useStore(store, "accounts") as AccountDto[];

  return (
    <Page name="accounts">
      <Navbar large title="Accounts" />
      <div style={{ padding: "4px 16px 20px" }}>
        <div className="list">
          {accounts.map((a) => (
            <div className="row" key={a.id}>
              <div className="glyph">{a.type === "cash" ? <CashGlyph /> : <InvestmentGlyph />}</div>
              <div className="row-main">
                <div className="sym">{a.name}</div>
                <div className="name">
                  {a.type === "cash" ? "Cash" : "Investment"}
                  {a.balances.length > 0 &&
                    ` · ${a.balances.length} ${a.balances.length === 1 ? "currency" : "currencies"}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Page>
  );
}
