import { fetchVapidPublicKey, subscribePush } from "../api/push";

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

export function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register("/sw.js");
}

// PushManager wants the VAPID key as a Uint8Array, not the base64url string
// the server hands back.
function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

// Requests OS notification permission, subscribes this device to web push,
// and registers the subscription with the backend. Must run from a user
// gesture (button tap) — iOS Safari silently ignores requestPermission()
// calls that aren't.
export async function enablePushNotifications(): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission denied");

  const registration = await registerServiceWorker();
  await navigator.serviceWorker.ready;

  const publicKey = await fetchVapidPublicKey();
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  await subscribePush(subscription);
}
