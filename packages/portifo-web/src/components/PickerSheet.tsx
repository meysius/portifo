import {
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonSearchbar,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { RadioDot } from "./ds";

export type PickerOption = { value: string; label: string; sublabel?: string };

type PickerSheetBaseProps = {
  isOpen: boolean;
  title: string;
  selected?: string;
  onClose(): void;
  onSelect(value: string): void;
};

type StaticPickerSheetProps = PickerSheetBaseProps & {
  mode: "static";
  options: PickerOption[];
  searchable?: boolean;
  placeholder?: string;
  // Renders a trailing "create new" row when the query doesn't exactly match
  // an existing option — e.g. the account picker's inline "+ New account…".
  allowCreate?: boolean;
  createLabel?(query: string): string;
  onCreate?(text: string): void;
};

type AsyncPickerSheetProps = PickerSheetBaseProps & {
  mode: "async";
  query: string;
  onQueryChange(query: string): void;
  options: PickerOption[];
  loading: boolean;
  error?: boolean;
  placeholder?: string;
  emptyHint?: string;
};

export type PickerSheetProps = StaticPickerSheetProps | AsyncPickerSheetProps;

// Generalizes the {open,value,onSelect,onClose} bottom-sheet-list pattern
// used throughout the app (currency picker, symbol search, transaction
// type/account/symbol filters, account picker w/ inline "+new" escape
// hatch) into one component with two variants: "static" filters a fixed
// option list locally; "async" defers query/loading/results to the caller
// (e.g. live symbol search).
function PickerSheet(props: PickerSheetProps) {
  const { isOpen, title, selected, onClose, onSelect } = props;
  const modalRef = useRef<HTMLIonModalElement>(null);
  const searchbarRef = useRef<HTMLIonSearchbarElement>(null);
  const nativeSearchRef = useRef<HTMLInputElement | null>(null);
  const hoistRef = useRef<HTMLInputElement>(null);
  const [staticQuery, setStaticQuery] = useState("");

  const isAsync = props.mode === "async";
  const hasSearch = isAsync || (props.mode === "static" && !!props.searchable);
  const query = isAsync ? props.query : staticQuery;

  useEffect(() => {
    if (!isOpen) return;
    setStaticQuery("");
  }, [isOpen]);

  // Resolve the searchbar's native <input> up front, so focusing it later can
  // be SYNCHRONOUS. ion-searchbar's own setFocus() is a lazy-loaded Stencil
  // method: calling it returns before the focus lands, and the focus arrives a
  // microtask too late for the check Ionic runs right after didPresent —
  // "is the active element inside me? if not, take focus back" (overlays.js).
  // The sheet host wins that race, the field is blurred, and on iOS the
  // keyboard closes with it. Focusing the input directly keeps Ionic's check
  // satisfied. Needs keepContentsMounted below to exist before the sheet opens.
  useEffect(() => {
    if (!hasSearch) return;
    let cancelled = false;
    searchbarRef.current?.getInputElement().then((el) => {
      if (!cancelled) nativeSearchRef.current = el;
    });
    return () => {
      cancelled = true;
    };
  }, [hasSearch]);

  // iOS raises the software keyboard only for a focus() that happens inside
  // the task the user's tap started. IonModal presents behind a ~300ms
  // animation, so by onDidPresent that window is long gone: the field takes
  // the caret but no keyboard appears, and the sheet still costs a tap before
  // you can type — the tap opening it was supposed to save. Focusing the
  // searchbar here instead does nothing at all, because the modal is still
  // display:none and focus() on hidden content is a no-op.
  //
  // So focus a 1px off-screen proxy input, which IS visible and IS in the tap's
  // task: the keyboard comes up for the proxy, and handing focus to the real
  // field on didPresent keeps it up — moving focus between two text inputs
  // never dismisses the keyboard, only blurring to nothing does.
  useLayoutEffect(() => {
    if (isOpen && hasSearch) hoistRef.current?.focus();
  }, [isOpen, hasSearch]);

  const focusSearch = () => {
    if (nativeSearchRef.current) nativeSearchRef.current.focus();
    else searchbarRef.current?.setFocus();
  };

  const dismissWith = (value: string) => {
    onSelect(value);
    modalRef.current?.dismiss();
  };

  const staticResults = useMemo(() => {
    if (props.mode !== "static") return [];
    if (!props.searchable) return props.options;
    const q = staticQuery.trim().toLowerCase();
    if (!q) return props.options;
    return props.options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q) || o.sublabel?.toLowerCase().includes(q),
    );
  }, [props, staticQuery]);

  const trimmedQuery = query.trim();
  const showCreateRow =
    props.mode === "static" &&
    props.allowCreate &&
    trimmedQuery.length > 0 &&
    !props.options.some((o) => o.value.toLowerCase() === trimmedQuery.toLowerCase());

  return (
    <>
      {/* The keyboard proxy from the layout effect above. It has to be a real,
          focusable, on-screen input — display:none, visibility:hidden and the
          hidden attribute all make focus() a no-op — so it's parked at 1px and
          transparent. 16px type is what stops iOS zooming the viewport on
          focus; it's never seen, but the zoom would be. */}
      {hasSearch && (
        <input
          ref={hoistRef}
          type="search"
          tabIndex={-1}
          aria-hidden="true"
          className="kb-hoist"
        />
      )}
      <IonModal
        ref={modalRef}
        isOpen={isOpen}
        keepContentsMounted={hasSearch}
        onDidDismiss={onClose}
        onDidPresent={hasSearch ? focusSearch : undefined}
        initialBreakpoint={0.75}
        breakpoints={[0, 0.75, 0.95]}
      >
        <IonHeader>
          <IonToolbar>
            <IonTitle>{title}</IonTitle>
          </IonToolbar>
          {(props.mode === "async" || props.searchable) && (
            <IonToolbar>
              <IonSearchbar
                ref={hasSearch ? searchbarRef : undefined}
                value={query}
                debounce={0}
                placeholder={props.placeholder ?? "Search"}
                onIonInput={(e) => {
                  const v = e.detail.value ?? "";
                  if (isAsync) props.onQueryChange(v);
                  else setStaticQuery(v);
                }}
              />
            </IonToolbar>
          )}
        </IonHeader>
        <IonContent>
          {isAsync && props.loading && (
            <div className="picker-status">
              <IonSpinner name="crescent" />
            </div>
          )}

          {isAsync && !props.loading && props.error && (
            <div className="picker-status">
              <IonNote color="danger">Search failed. Try again.</IonNote>
            </div>
          )}

          {isAsync && !props.loading && !props.error && trimmedQuery.length === 0 && (
            <div className="picker-status">
              <IonNote>{props.emptyHint ?? "Start typing to search."}</IonNote>
            </div>
          )}

          {isAsync && !props.loading && !props.error && trimmedQuery.length > 0 && props.options.length === 0 && (
            <div className="picker-status">
              <IonNote>No matches for "{query}"</IonNote>
            </div>
          )}

          {((isAsync && !props.loading && !props.error && props.options.length > 0) ||
            (!isAsync && (staticResults.length > 0 || showCreateRow))) && (
            <IonList lines="full">
              {(isAsync ? props.options : staticResults).map((option) => (
                <IonItem key={option.value} button detail={false} onClick={() => dismissWith(option.value)}>
                  <IonLabel>
                    <h2>{option.label}</h2>
                    {option.sublabel && <p>{option.sublabel}</p>}
                  </IonLabel>
                  <RadioDot checked={option.value === selected} />
                </IonItem>
              ))}
              {showCreateRow && props.mode === "static" && (
                <IonItem
                  button
                  detail={false}
                  onClick={() => {
                    if (props.onCreate) props.onCreate(trimmedQuery);
                    else onSelect(trimmedQuery);
                    modalRef.current?.dismiss();
                  }}
                >
                  <IonLabel color="primary">{props.createLabel ? props.createLabel(trimmedQuery) : `+ Create "${trimmedQuery}"`}</IonLabel>
                </IonItem>
              )}
            </IonList>
          )}

          {!isAsync && staticResults.length === 0 && !showCreateRow && (
            <div className="picker-status">
              <IonNote>No matches for "{staticQuery}"</IonNote>
            </div>
          )}
        </IonContent>
      </IonModal>
    </>
  );
}

export default PickerSheet;
