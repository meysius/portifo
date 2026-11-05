// The Extended hours toggle under a chart, with its note: why it can't draw
// on this range, or why, on, it adds nothing (Toronto, London, crypto, a
// listing that hasn't traded outside regular hours). It draws on 1D only.
export default function ExtendedHoursChip({
  fits,
  on,
  untraded,
  onToggle,
}: {
  fits: boolean;
  on: boolean;
  untraded: boolean;
  onToggle: () => void;
}) {
  const note = !fits ? "1D only" : untraded ? "No extended-hours trades" : null;
  return (
    <span className="hd-indicator-group">
      <button type="button" className="hd-indicator" aria-pressed={on} disabled={!fits} onClick={onToggle}>
        {/* A line that runs on from the regular session, solid, into a
            recessed stretch, faded, as the chart draws it. */}
        <span className="hd-indicator-extended" aria-hidden="true">
          <span />
          <span />
        </span>
        Extended hours
      </button>
      {note && <span className="hd-indicator-note">{note}</span>}
    </span>
  );
}
