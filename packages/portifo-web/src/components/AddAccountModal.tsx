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
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { useState } from "react";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useToast } from "../context/ToastContext";
import type { NewAccount } from "../api/portfolio";

function AddAccountModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { createAccount } = usePortfolioData();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [type, setType] = useState<NewAccount["type"]>("investment");
  const [saving, setSaving] = useState(false);

  const isValid = name.trim().length > 0;
  const isDirty = name.trim().length > 0 || type !== "investment";

  const reset = () => {
    setName("");
    setType("investment");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      await createAccount({ name: name.trim(), type });
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
            <IonButton strong disabled={!isValid || !isDirty || saving} onClick={handleSave}>
              Save
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonSegment
          value={type}
          onIonChange={(e) => setType(e.detail.value as NewAccount["type"])}
          className="seg-card"
        >
          <IonSegmentButton value="investment">
            <IonLabel>Investment</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="cash">
            <IonLabel>Cash</IonLabel>
          </IonSegmentButton>
        </IonSegment>

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
