import { IonContent, IonHeader, IonItem, IonLabel, IonList, IonModal, IonTitle, IonToolbar } from "@ionic/react";
import { useRef } from "react";
import { RadioDot } from "./components/ds";
import { CURRENCIES } from "./lib/currencies";

function CurrencyPickerSheet({
  isOpen,
  selected,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  selected: string;
  onClose: () => void;
  onSelect: (code: string) => void;
}) {
  const modalRef = useRef<HTMLIonModalElement>(null);

  return (
    <IonModal
      ref={modalRef}
      isOpen={isOpen}
      onDidDismiss={onClose}
      initialBreakpoint={0.6}
      breakpoints={[0, 0.6, 0.92]}
    >
      <IonHeader>
        <IonToolbar>
          <IonTitle>Currency</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {/* Short, fixed list (a handful of display currencies) — no search
            field; the user just picks from the list. */}
        <IonList>
          {CURRENCIES.map((currency) => (
            <IonItem
              key={currency.code}
              button
              detail={false}
              onClick={() => {
                onSelect(currency.code);
                modalRef.current?.dismiss();
              }}
            >
              <IonLabel>
                <h2>{currency.code}</h2>
                <p>{currency.name}</p>
              </IonLabel>
              <RadioDot checked={currency.code === selected} />
            </IonItem>
          ))}
        </IonList>
      </IonContent>
    </IonModal>
  );
}

export default CurrencyPickerSheet;
