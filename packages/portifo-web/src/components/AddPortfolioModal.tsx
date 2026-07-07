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

// Creating a portfolio also switches to it (see PortfolioDataContext), so on
// save the screen behind this modal is already showing the new empty portfolio.
function AddPortfolioModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { createPortfolio } = usePortfolioData();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const isValid = name.trim().length > 0;

  const handleClose = () => {
    setName("");
    onClose();
  };

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      await createPortfolio(name.trim());
      showToast("Portfolio created");
      handleClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create portfolio", { color: "danger" });
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
          <IonTitle>New Portfolio</IonTitle>
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
              placeholder="e.g. Retirement"
              onIonInput={(e) => setName(e.detail.value ?? "")}
            />
          </IonItem>
        </IonList>
      </IonContent>
    </IonModal>
  );
}

export default AddPortfolioModal;
