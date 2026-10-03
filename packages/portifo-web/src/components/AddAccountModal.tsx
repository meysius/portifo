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
import { useState } from "react";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useToast } from "../context/ToastContext";

function AddAccountModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { createAccount } = usePortfolioData();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const isValid = name.trim().length > 0;

  const reset = () => setName("");

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      await createAccount({ name: name.trim() });
      showToast("Account created");
      reset();
      onClose();
    } catch {
      showToast("Failed to create account", { color: "danger" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={handleClose}>
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
              slot="end"
              className="ion-text-end"
              value={name}
              placeholder="e.g. Interactive Brokers"
              onIonInput={(e) => setName(e.detail.value ?? "")}
            />
          </IonItem>
        </IonList>
      </IonContent>
    </IonModal>
  );
}

export default AddAccountModal;
