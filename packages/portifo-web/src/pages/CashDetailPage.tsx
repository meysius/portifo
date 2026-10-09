import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import type { ReactNode } from "react";
import { useHistory } from "react-router-dom";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useTabBase } from "../context/TabBaseContext";
import { BACK_ICON } from "../lib/backIcon";
import { CURRENCIES } from "../lib/currencies";
import { useDisplayCurrency } from "../lib/displayCurrency";
import { convert, fmtCcy } from "../lib/fx";
import { cashValue } from "../lib/positions";
import { useHeadingScrolledAway } from "../lib/useHeadingScrolledAway";

// All of the portfolio's cash, pushed from Portfolio's Cash row: where it is
// and in what currency. The total leads in the display currency, then what
// each currency adds up to, then every account with one row per currency it
// holds. A balance always names its currency beside it, because "$" alone
// could be US, Canadian or Australian dollars. A balance row opens its
// account, where the balance can be set.

const icon = (body: ReactNode, size = 20) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {body}
  </svg>
);
const CASH = icon(
  <>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <circle cx="12" cy="12" r="3" />
  </>,
  18,
);

const currencyName = (code: string) => CURRENCIES.find((c) => c.code === code)?.name ?? code;
const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const percent = (n: number) => `${n.toFixed(1)}%`;

// One currency's balance in one account, and its worth in the display currency.
type Line = { currency: string; balance: number; value: number };

function CashDetailPage() {
  const history = useHistory();
  const { tabBase, tabLabel } = useTabBase();
  const { accounts, cashByCurrency, fxRates, loading } = usePortfolioData();
  const [ccy] = useDisplayCurrency();
  const { headingRef, away, onIonScroll } = useHeadingScrolledAway<HTMLDivElement>();

  // A converted figure carries the display currency's code too: "≈ $6,150.00
  // USD" under a CAD balance of "$8,300.00" can't be misread.
  const approx = (value: number) => `≈ ${fmtCcy(value, ccy)} ${ccy}`;

  // Accounts with cash, largest first; inside each, its currencies largest first.
  const holders = accounts
    .map((a) => {
      const lines: Line[] = a.balances
        .filter((b) => Math.abs(b.balance) >= 0.005)
        .map((b) => ({ currency: b.currency, balance: b.balance, value: convert(b.balance, b.currency, ccy, fxRates) }))
        .sort((x, y) => y.value - x.value);
      return { id: a.id, name: a.name, lines, value: lines.reduce((sum, l) => sum + l.value, 0) };
    })
    .filter((h) => h.lines.length > 0)
    .sort((a, b) => b.value - a.value);

  const byCurrency = new Map<string, Line & { accounts: string[] }>();
  for (const h of holders) {
    for (const l of h.lines) {
      const t = byCurrency.get(l.currency) ?? { currency: l.currency, balance: 0, value: 0, accounts: [] };
      t.balance += l.balance;
      t.value += l.value;
      t.accounts.push(h.name);
      byCurrency.set(l.currency, t);
    }
  }
  const currencies = [...byCurrency.values()].sort((a, b) => b.value - a.value);

  // The same figure as Portfolio's Cash row.
  const total = cashValue(cashByCurrency, ccy, fxRates);
  // A share means nothing once an overdrawn balance is in the sum.
  const shares = total > 0 && currencies.every((c) => c.value >= 0);
  const converted = currencies.some((c) => c.currency !== ccy);
  const ready = !loading.accounts || accounts.length > 0;
  const openAccount = (id: string) => history.push(`${tabBase}/account/${id}`);

  return (
    <IonPage className="ds-screen ac-page ac-detail-page cash-page">
      <IonHeader className={`ac-detail-header${away ? " collapsed" : ""}`}>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={tabBase} text={tabLabel} icon={BACK_ICON} />
          </IonButtons>
          <IonTitle>Cash</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent scrollEvents onIonScroll={onIonScroll}>
        <div className="ac-heading" ref={headingRef}>
          <h1>Cash</h1>
        </div>

        {holders.length > 0 ? (
          <>
            <p className="ac-subtitle">
              {count(holders.length, "account")} ·{" "}
              {currencies.length === 1 ? `All in ${currencies[0].currency}` : count(currencies.length, "currency", "currencies")}
            </p>

            <section className="ac-hero" aria-label="Total cash">
              <div className="ac-hero-label">Total cash · {ccy}</div>
              <div className="ac-hero-row">
                <span className="ac-hero-value money">{fmtCcy(total, ccy)}</span>
              </div>
            </section>

            {/* What the total is made of; one currency is already said by the
                subtitle. Not tappable: a currency spans accounts. */}
            {currencies.length > 1 && (
              <section className="ac-section" aria-label="Cash by currency">
                <div className="ac-section-heading">
                  <h2>Currencies</h2>
                  {shares && <span className="meta">Share of cash</span>}
                </div>
                {currencies.map((c) => {
                  const note = [c.currency !== ccy && approx(c.value), shares && percent((c.value / total) * 100)]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <div key={c.currency} className="ac-cash-row cash-static">
                      <span className="ac-account-icon">{CASH}</span>
                      <span className="ac-cash-identity">
                        <span className="ac-holding-symbol">{c.currency}</span>
                        <span className="ac-holding-meta">
                          {currencyName(c.currency)} · {c.accounts.length === 1 ? c.accounts[0] : count(c.accounts.length, "account")}
                        </span>
                      </span>
                      <span className="cash-end">
                        <span className="money">{fmtCcy(c.balance, c.currency)}</span>
                        {note && <span className="cash-note money">{note}</span>}
                      </span>
                    </div>
                  );
                })}
              </section>
            )}

            <section className="ac-section" aria-label="Cash by account">
              <div className="ac-section-heading">
                <h2>
                  Accounts <span className="meta">{holders.length}</span>
                </h2>
              </div>
              {holders.map((h) => (
                <div key={h.id} className="cash-account" role="group" aria-label={h.name}>
                  <div className="cash-account-heading">
                    <span className="cash-account-name">{h.name}</span>
                    {h.lines.length > 1 && <span className="cash-note money">{approx(h.value)}</span>}
                  </div>
                  {h.lines.map((l) => (
                    <button
                      key={l.currency}
                      type="button"
                      className="ac-cash-row"
                      aria-label={`${h.name}, ${l.currency} ${fmtCcy(l.balance, l.currency)}${l.currency !== ccy ? `, ${approx(l.value)}` : ""}, view account`}
                      onClick={() => openAccount(h.id)}
                    >
                      <span className="ac-account-icon cash">{CASH}</span>
                      <span className="ac-cash-identity">
                        <span className="ac-holding-symbol">{l.currency}</span>
                        <span className="ac-holding-meta">{currencyName(l.currency)}</span>
                      </span>
                      <span className="cash-end">
                        <span className="money">{fmtCcy(l.balance, l.currency)}</span>
                        {l.currency !== ccy && <span className="cash-note money">{approx(l.value)}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </section>

            <p className="ac-footer-note">
              {converted ? (
                <>
                  Balances in their own currency
                  <br />
                  Totals in {ccy} at today’s exchange rates
                </>
              ) : (
                `All amounts in ${ccy}`
              )}
            </p>
          </>
        ) : (
          ready && (
            <section className="ac-empty">
              <div className="ac-empty-symbol">{CASH}</div>
              <h2>No cash yet</h2>
              <p>Set a cash balance on an account, or record a deposit. It shows up here in its own currency.</p>
            </section>
          )
        )}
      </IonContent>
    </IonPage>
  );
}

export default CashDetailPage;
