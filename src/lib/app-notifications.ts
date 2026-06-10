export type NotificationPermissionState = NotificationPermission | "unsupported";

const notificationIcon = "/va-consultoria-mark.png";

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function getNotificationPermission(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestAppNotificationPermission(): Promise<NotificationPermissionState> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }

  return Notification.requestPermission();
}

export async function subscribeDeviceToPush() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, reason: "unsupported" as const };
  }

  if (getNotificationPermission() !== "granted") {
    return { ok: false, reason: "permission" as const };
  }

  const keyResponse = await fetch("/api/push/public-key", {
    headers: { accept: "application/json" },
  });
  if (!keyResponse.ok) return { ok: false, reason: "server" as const };

  const { publicKey } = (await keyResponse.json()) as { publicKey?: string };
  if (!publicKey) return { ok: false, reason: "server" as const };

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const subscribeResponse = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ subscription }),
  });

  return { ok: subscribeResponse.ok, reason: subscribeResponse.ok ? undefined : ("server" as const) };
}

export async function showAppNotification({
  title,
  body,
  tag,
  url,
}: {
  title: string;
  body: string;
  tag: string;
  url: string;
}) {
  if (getNotificationPermission() !== "granted") return false;

  const options: NotificationOptions = {
    body,
    icon: notificationIcon,
    badge: notificationIcon,
    tag,
    renotify: true,
    data: { url },
  };

  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, options);
      return true;
    }
  } catch (error) {
    console.warn("Could not show service worker notification", error);
  }

  try {
    const notification = new Notification(title, options);
    notification.onclick = () => {
      window.focus();
      window.location.href = url;
      notification.close();
    };
    return true;
  } catch (error) {
    console.warn("Could not show browser notification", error);
    return false;
  }
}
