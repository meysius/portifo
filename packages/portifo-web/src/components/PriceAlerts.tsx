import { useState } from "react";
import type { FormEvent } from "react";
import { isOn } from "../api/alerts";
import type { AlertDirection, AlertMode, PriceAlert } from "../api/alerts";
import { EXTENDED_LABEL } from "../api/market";
import type { Quote } from "../api/market";
import { useAlerts } from "../context/AlertsContext";
import { useToast } from "../context/ToastContext";
import { fmtExactCcy, fmtTradedCcy } from "../lib/fx";
import { cleanDecimal } from "../lib/forms";
import DsSheet from "./DsSheet";

// A watched symbol's price alerts: a section for its page, listing each rule,
// and the sheet that adds, edits or deletes one. A "once" rule fires once, then
// stays listed as a record of when it went off until it's saved again or
// deleted. A "live" rule goes off at every step it crosses, and keeps going.

const CROSSES: Record<AlertDirection, string> = {
  both: "Crosses either way",
  below: "Crosses below",
  above: "Crosses above",
};

// The sheet's tiles. Once and Either way come first: a new rule starts as them.
const MODES: [AlertMode, string][] = [
  ["once", "Once"],
  ["live", "Live"],
];
const SIDES: [AlertDirection, string][] = [
  ["both", "Either way"],
  ["below", "Below"],
  ["above", "Above"],
];

const ruleLabel = (a: PriceAlert) =>
  a.mode === "live" ? `Live · ${CROSSES[a.direction].toLowerCase()}` : CROSSES[a.direction];

// "Oct 30"; the year only when it isn't this year.
function fmtDate(iso: string) {
  const d = new Date(iso);
  const thisYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: thisYear ? undefined : "numeric" });
}

// A time today, as a live rule can go off several times a day; a date before.
function fmtWhen(iso: string) {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : fmtDate(iso);
}

const wentOff = (a: PriceAlert, currency: string) =>
  `Went off ${fmtDate(a.triggeredAt!)} at ${fmtTradedCcy(a.triggeredPrice!, currency)}`;

const lastWentOff = (a: PriceAlert, currency: string) =>
  `Last went off ${fmtWhen(a.triggeredAt!)} at ${fmtTradedCcy(a.triggeredPrice!, currency)}`;

// What a "once" rule will do, now that the market is where it is.
function outcome(symbol: string, direction: AlertDirection, target: number, latest: number) {
  if (direction === "both") {
    return latest === target
      ? `${symbol} is at this price now. You’ll be notified if it moves away and crosses back.`
      : "You’ll be notified once, when it crosses this price.";
  }
  const below = direction === "below";
  if (below ? latest <= target : latest >= target) {
    return `${symbol} is already ${direction} this price. You’ll be notified if it ${below ? "rises above it and falls back" : "falls below it and rises back"}.`;
  }
  return "You’ll be notified once, when it crosses this price.";
}

// A live rule's next levels: the multiples of its step either side of the
// price, not counting one it's on, as the server starts from the price too.
function nextLevels(latest: number, step: number) {
  const q = latest / step;
  const k = Math.round(q);
  const onLevel = Math.abs(q - k) < 1e-9;
  return { below: (onLevel ? k - 1 : Math.floor(q)) * step, above: (onLevel ? k + 1 : Math.ceil(q)) * step };
}

function liveOutcome(direction: AlertDirection, step: number, latest: number, currency: string) {
  const fmt = (n: number) => fmtExactCcy(n, currency);
  const { below, above } = nextLevels(latest, step);
  if (direction === "below") return `You’ll be notified at every ${fmt(step)} level it falls through, next at ${fmt(below)}.`;
  if (direction === "above") return `You’ll be notified at every ${fmt(step)} level it rises through, next at ${fmt(above)}.`;
  return `You’ll be notified at every ${fmt(step)} level it crosses, next at ${fmt(below)} or ${fmt(above)}.`;
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
  const [mode, setMode] = useState<AlertMode>(alert?.mode ?? "once");
  const [direction, setDirection] = useState<AlertDirection>(alert?.direction ?? "both");
  // A target and a step aren't the same number, so each mode keeps its own:
  // switching back and forth doesn't turn a $190 target into a $190 step.
  const [amounts, setAmounts] = useState<Record<AlertMode, string>>({
    once: alert?.mode === "once" ? String(alert.price) : "",
    live: alert?.mode === "live" ? String(alert.price) : "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const live = mode === "live";
  const amount = Number(amounts[mode]);
  const noun = live ? "step" : "price";
  const latest = quote.extended?.price ?? quote.price;
  const session = quote.extended ? ` ${EXTENDED_LABEL[quote.extended.session].toLowerCase()}` : "";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!(amount > 0)) {
      setError(`Enter a ${noun} above zero.`);
      return;
    }
    if (amount >= 1e12) {
      setError(`Enter a ${noun} below one trillion.`);
      return;
    }
    // Started first, while this is still the tap, and not awaited: the rule
    // stands whatever the answer, and the OS prompt shouldn't hold it up.
    enableNotifications();
    setBusy(true);
    try {
      const input = { mode, direction, price: amount };
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

  const tiles = <T extends string>(options: [T, string][], value: T, onPick: (v: T) => void) =>
    options.map(([v, label]) => (
      <button
        key={v}
        type="button"
        className={`ds-sheet-option${v === value ? " active" : ""}`}
        aria-pressed={v === value}
        onClick={() => {
          onPick(v);
          setError("");
        }}
      >
        {label}
      </button>
    ));

  return (
    <form noValidate onSubmit={submit}>
      {alert && !isOn(alert) && (
        <p className="ds-sheet-notice wl-alert-fired">{wentOff(alert, quote.currency)}. Saving turns it back on.</p>
      )}
      <p className="ds-field-label" id="wl-alert-modes-label">
        Mode
      </p>
      <div className="wl-alert-modes" role="group" aria-labelledby="wl-alert-modes-label">
        {tiles(MODES, mode, setMode)}
      </div>
      <p className="ds-field-label" id="wl-alert-sides-label">
        Crosses
      </p>
      <div className="wl-alert-sides" role="group" aria-labelledby="wl-alert-sides-label">
        {tiles(SIDES, direction, setDirection)}
      </div>
      <label className="ds-field-label" htmlFor="wl-alert-price">
        {live ? "Step" : "Price per share"} · {quote.currency}
      </label>
      <input
        id="wl-alert-price"
        className="ds-field"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        value={amounts[mode]}
        onChange={(e) => {
          const value = cleanDecimal(e.target.value);
          setAmounts((a) => ({ ...a, [mode]: value }));
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
        {amount > 0 && (
          <>
            <br />
            {live
              ? liveOutcome(direction, amount, latest, quote.currency)
              : outcome(symbol, direction, amount, latest)}
          </>
        )}
      </p>
      <button type="submit" className="ds-action" disabled={busy}>
        {!alert ? "Create alert" : !isOn(alert) ? "Turn alert back on" : "Save alert"}
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
    .sort((a, b) => Number(!isOn(a)) - Number(!isOn(b)));
  const running = rules.some(isOn);
  if (!watching && !rules.length) return null;

  const status = (a: PriceAlert) => {
    if (!isOn(a)) return wentOff(a, quote.currency);
    if (!watching) return "Paused";
    return a.triggeredAt ? lastWentOff(a, quote.currency) : "Active";
  };

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

      {rules.map((a) => {
        // A live rule's figure is its step, labelled as one.
        const code = a.mode === "live" ? `Step · ${quote.currency}` : quote.currency;
        return (
          <button
            key={a.id}
            type="button"
            className="wl-alert"
            aria-label={`${ruleLabel(a)}, ${code} ${fmtExactCcy(a.price, quote.currency)}, ${status(a)}. Edit alert`}
            onClick={() => openSheet(a)}
          >
            <span className="wl-identity">
              <span className="wl-alert-rule">{ruleLabel(a)}</span>
              <span className="wl-meta">{status(a)}</span>
            </span>
            <span className="wl-price">
              <span className="wl-ccy">{code}</span>
              <span className="money">{fmtExactCcy(a.price, quote.currency)}</span>
            </span>
          </button>
        );
      })}

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
