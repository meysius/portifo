import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { useRef, useState } from "react";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useToast } from "../context/ToastContext";

function AddAccountModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { createAccount } = usePortfolioData();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLIonInputElement>(null);

  const isValid = name.trim().length > 0;

  const reset = () => setName("");

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    try {
      await createAccount({ name: name.trim() });
      showToast("Account created");
      reset();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create account", { color: "danger" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={handleClose} onDidPresent={() => inputRef.current?.setFocus()}>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={handleClose}>Cancel</IonButton>
          </IonButtons>
          <IonTitle>Add Account</IonTitle>
          <IonButtons slot="end">
            <IonButton strong disabled={!isValid || saving} onClick={handleSave}>
              Save
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonList inset className="fieldcard-list form-list">
          <IonItem>
            <IonLabel>Name</IonLabel>
            <IonInput
              ref={inputRef}
              slot="end"
              className="ion-text-end"
              value={name}
              placeholder="e.g. Interactive Brokers"
              enterkeyhint="done"
              onIonInput={(e) => setName(e.detail.value ?? "")}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
            />
          </IonItem>
        </IonList>
      </IonContent>
    </IonModal>
  );
}

export default AddAccountModal;
