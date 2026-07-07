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
  const [staticQuery, setStaticQuery] = useState("");

  const isAsync = props.mode === "async";
  const query = isAsync ? props.query : staticQuery;

  useEffect(() => {
    if (!isOpen) return;
    setStaticQuery("");
  }, [isOpen]);

  // iOS only lets focus() raise the software keyboard within the same task
  // as the triggering gesture — IonModal's onDidPresent fires after the
  // sheet animation (~300ms), outside that window. A layout effect keyed on
  // isOpen fires synchronously right after the triggering state update,
  // still inside the activation window. Requires keepContentsMounted below.
  useLayoutEffect(() => {
    if (isOpen && isAsync) searchbarRef.current?.setFocus();
  }, [isOpen, isAsync]);

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
    <IonModal
      ref={modalRef}
      isOpen={isOpen}
      keepContentsMounted={isAsync}
      onDidDismiss={onClose}
      onDidPresent={isAsync ? () => searchbarRef.current?.setFocus() : undefined}
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
              ref={isAsync ? searchbarRef : undefined}
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
  );
}

export default PickerSheet;
