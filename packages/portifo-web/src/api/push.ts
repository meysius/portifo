import { apiFetch } from "./http";

export async function fetchVapidPublicKey(): Promise<string> {
  const res = await fetch("/push/vapid-public-key");
  if (!res.ok) throw new Error("Failed to fetch VAPID public key");
  const { publicKey } = await res.json();
  return publicKey;
}

export async function subscribePush(subscription: PushSubscription): Promise<void> {
  const res = await apiFetch("/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!res.ok) throw new Error("Failed to save push subscription");
}

export async function sendTestPush(): Promise<{ sent: number; pruned: number }> {
  const res = await apiFetch("/push/test", { method: "POST" });
  if (!res.ok) throw new Error("Failed to send test notification");
  return res.json();
}
