// The bar every screen shares once scrolled: the page's title, centred, over
// a hairline — what Holding detail's header becomes when it collapses. A tab
// root has nothing in it at rest, so it is absent until the page heading has
// scrolled away (see useHeadingScrolledAway), and it repeats the heading, so
// assistive tech skips it.
export default function StickyTitleBar({ title, shown }: { title: string; shown: boolean }) {
  return (
    <div className={`ds-sticky-bar${shown ? " shown" : ""}`} aria-hidden="true">
      <span className="ds-sticky-title">{title}</span>
    </div>
  );
}
