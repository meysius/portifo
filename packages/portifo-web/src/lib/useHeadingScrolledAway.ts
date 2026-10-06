import { useCallback, useRef, useState } from "react";

// True once the page heading has scrolled up past the top of its IonContent —
// the moment a tab root's sticky bar takes over its title. Wire `onIonScroll`
// to an IonContent with `scrollEvents` and `headingRef` to the heading.
export function useHeadingScrolledAway<T extends HTMLElement>() {
  const headingRef = useRef<T>(null);
  const [away, setAway] = useState(false);
  const onIonScroll = useCallback((e: CustomEvent) => {
    const heading = headingRef.current;
    if (!heading) return;
    const top = (e.target as HTMLElement).getBoundingClientRect().top;
    setAway(heading.getBoundingClientRect().bottom <= top + 1);
  }, []);
  return { headingRef, away, onIonScroll };
}
