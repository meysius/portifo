import { Page, Navbar, useStore } from "framework7-react";
import { store } from "../store.ts";
import type { AuthUser } from "../api/auth";

export default function SettingsPage() {
  const user = useStore(store, "user") as AuthUser | null;

  return (
    <Page name="settings">
      <Navbar large title="Settings" />
      <div style={{ padding: "20px 16px" }}>
        <div className="divider">
          <span className="dl">Account</span>
          <span className="dh" />
        </div>
        <div className="field-card">
          <div className="field">
            <span className="field-label">{user?.name}</span>
            <span className="field-input">{user?.email}</span>
          </div>
        </div>

        <div className="btn-stack" style={{ marginTop: 24 }}>
          <button type="button" className="btn btn-secondary" onClick={() => store.dispatch("logout", undefined)}>
            Log Out
          </button>
        </div>
      </div>
    </Page>
  );
}
