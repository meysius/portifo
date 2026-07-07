import { IonToast } from "@ionic/react";
import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

type ToastColor = "success" | "danger" | "medium";

interface ToastContextValue {
  showToast(message: string, opts?: { color?: ToastColor }): void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Single IonToast mounted once at the app root — replaces portifo-web's
// pattern of reimplementing a useState+setTimeout toast independently in
// three different screens.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ message: string; color?: ToastColor } | null>(null);

  const showToast = useCallback((message: string, opts?: { color?: ToastColor }) => {
    setState({ message, color: opts?.color });
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <IonToast
        isOpen={state !== null}
        message={state?.message}
        color={state?.color}
        duration={1800}
        onDidDismiss={() => setState(null)}
      />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
