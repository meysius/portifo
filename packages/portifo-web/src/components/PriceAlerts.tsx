import { useState } from "react";
import type { FormEvent } from "react";
import type { AlertDirection, PriceAlert } from "../api/alerts";
import { EXTENDED_LABEL } from "../api/market";
import type { Quote } from "../api/market";
import { useAlerts } from "../context/AlertsContext";
import { useToast } from "../context/ToastContext";
import { fmtExactCcy, fmtTradedCcy } from "../lib/fx";
import { cleanDecimal } from "../lib/forms";
import DsSheet from "./DsSheet";

// A watched symbol's price alerts: a section for its page, listing each rule,
// and the sheet that adds, edits or deletes one. A rule fires once, then stays
// listed as a record of when it went off until it's saved again or deleted.

const CROSSES: Record<AlertDirection, string> = { below: "Crosses below", above: "Crosses above" };

// "Oct 30"; the year only when it isn't this year.
function fmtDate(iso: string) {
  const d = new Date(iso);
  const thisYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: thisYear ? undefined : "numeric" });
}

const wentOff = (a: PriceAlert, currency: string) =>
  `Went off ${fmtDate(a.triggeredAt!)} at ${fmtTradedCcy(a.triggeredPrice!, currency)}`;

// What the rule will do, now that the market is where it is.
function outcome(symbol: string, direction: AlertDirection, target: number, latest: number) {
  const below = direction === "below";
  if (below ? latest <= target : latest >= target) {
    return `${symbol} is already ${direction} this price. You’ll be notified if it ${below ? "rises above it and falls back" : "falls below it and rises back"}.`;
  }
  return "You’ll be notified once, when it crosses this price.";
}

function AlertForm({
  symbol,
  quote,
  alert,
  onDone,
}: {
  symbol: string;
  quote: Quote;
  alert: PriceAlert | null;
  onDone: () => void;
}) {
  const { create, update, remove, enableNotifications } = useAlerts();
  const { showToast } = useToast();
  const [direction, setDirection] = useState<AlertDirection>(alert?.direction ?? "below");
  const [price, setPrice] = useState(alert ? String(alert.price) : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const target = Number(price);
  const latest = quote.extended?.price ?? quote.price;
  const session = quote.extended ? ` ${EXTENDED_LABEL[quote.extended.session].toLowerCase()}` : "";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!(target > 0)) {
      setError("Enter a price above zero.");
      return;
    }
    if (target >= 1e12) {
      setError("Enter a price below one trillion.");
      return;
    }
    // Started first, while this is still the tap, and not awaited: the rule
    // stands whatever the answer, and the OS prompt shouldn't hold it up.
    enableNotifications();
    setBusy(true);
    try {
      const input = { direction, price: target };
      await (alert ? update(alert.id, input) : create(symbol, input));
      onDone();
    } catch {
      setError("This alert couldn’t be saved. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const destroy = async () => {
    setBusy(true);
    try {
      await remove(alert!.id);
      onDone();
      showToast("Alert deleted");
    } catch {
      setError("This alert couldn’t be deleted. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form noValidate onSubmit={submit}>
      {alert?.triggeredAt && (
        <p className="ds-sheet-notice wl-alert-fired">{wentOff(alert, quote.currency)}. Saving turns it back on.</p>
      )}
      <div className="wl-alert-sides" role="group" aria-label={`Notify me when ${symbol}`}>
        {(["below", "above"] as const).map((d) => (
          <button
            key={d}
            type="button"
            className={`ds-sheet-option${d === direction ? " active" : ""}`}
            aria-pressed={d === direction}
            onClick={() => setDirection(d)}
          >
            {CROSSES[d]}
          </button>
        ))}
      </div>
      <label className="ds-field-label" htmlFor="wl-alert-price">
        Price per share · {quote.currency}
      </label>
      <input
        id="wl-alert-price"
        className="ds-field"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        value={price}
        onChange={(e) => {
          setPrice(cleanDecimal(e.target.value));
          setError("");
        }}
      />
      {error && (
        <p className="ds-form-error" role="alert">
          {error}
        </p>
      )}
      <p className="ds-sheet-notice">
        {symbol} is at <span className="money">{fmtTradedCcy(latest, quote.currency)}</span> {quote.currency}
        {session}.
        {target > 0 && (
          <>
            <br />
            {outcome(symbol, direction, target, latest)}
          </>
        )}
      </p>
      <button type="submit" className="ds-action" disabled={busy}>
        {!alert ? "Create alert" : alert.triggeredAt ? "Turn alert back on" : "Save alert"}
      </button>
      {alert && (
        <button type="button" className="wl-alert-delete" disabled={busy} onClick={destroy}>
          Delete alert
        </button>
      )}
    </form>
  );
}

const PUSH_NOTICE = {
  on: "",
  off: "Notifications are off on this device.",
  blocked: "Notifications are blocked for Portifo. Allow them in your device’s settings to get these alerts.",
  unsupported: "To get these on your phone, add Portifo to your Home Screen and open it from there.",
};

export default function PriceAlerts({ symbol, quote, watching }: { symbol: string; quote: Quote; watching: boolean }) {
  const { alerts, pushStatus, enableNotifications } = useAlerts();
  // The rule the sheet edits, or null to add one. Kept when it closes, as the
  // sheet still shows it while sliding away; `key` starts a fresh form each time.
  const [sheet, setSheet] = useState<{ open: boolean; alert: PriceAlert | null; key: number }>({
    open: false,
    alert: null,
    key: 0,
  });
  const openSheet = (alert: PriceAlert | null) => setSheet((s) => ({ open: true, alert, key: s.key + 1 }));
  const closeSheet = () => setSheet((s) => ({ ...s, open: false }));

  const rules = (alerts ?? [])
    .filter((a) => a.symbol === symbol)
    .sort((a, b) => Number(!!a.triggeredAt) - Number(!!b.triggeredAt));
  const running = rules.some((a) => !a.triggeredAt);
  if (!watching && !rules.length) return null;

  const status = (a: PriceAlert) => (a.triggeredAt ? wentOff(a, quote.currency) : watching ? "Active" : "Paused");

  return (
    <section className="hd-section wl-alerts">
      <div className="hd-section-heading">
        <h2>Price alerts</h2>
        {watching && (
          <button type="button" className="wl-alert-add" onClick={() => openSheet(null)}>
            Add alert
          </button>
        )}
      </div>

      {!watching && <p className="wl-alert-note">Paused while {symbol} is off your watchlist.</p>}
      {watching && !rules.length && (
        <p className="wl-alert-note">Get a notification when {symbol} crosses a price you choose.</p>
      )}
      {watching && running && pushStatus !== "on" && (
        <p className="wl-alert-note">
          {PUSH_NOTICE[pushStatus]}
          {pushStatus === "off" && (
            <>
              {" "}
              <button type="button" className="wl-alert-enable" onClick={enableNotifications}>
                Turn on notifications
              </button>
            </>
          )}
        </p>
      )}

      {rules.map((a) => (
        <button
          key={a.id}
          type="button"
          className="wl-alert"
          aria-label={`${CROSSES[a.direction]} ${quote.currency} ${fmtExactCcy(a.price, quote.currency)}, ${status(a)}. Edit alert`}
          onClick={() => openSheet(a)}
        >
          <span className="wl-identity">
            <span className="wl-alert-rule">{CROSSES[a.direction]}</span>
            <span className="wl-meta">{status(a)}</span>
          </span>
          <span className="wl-price">
            <span className="wl-ccy">{quote.currency}</span>
            <span className="money">{fmtExactCcy(a.price, quote.currency)}</span>
          </span>
        </button>
      ))}

      <DsSheet
        isOpen={sheet.open}
        onClose={closeSheet}
        title={sheet.alert ? `Edit ${symbol} alert` : `New ${symbol} alert`}
        titleId="wl-alert-title"
        className="wl-alert-sheet"
      >
        <AlertForm key={sheet.key} symbol={symbol} quote={quote} alert={sheet.alert} onDone={closeSheet} />
      </DsSheet>
    </section>
  );
}
