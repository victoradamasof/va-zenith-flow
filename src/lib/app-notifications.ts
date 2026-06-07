export type NotificationPermissionState = NotificationPermission | "unsupported";

const notificationIcon = "/va-consultoria-mark.png";

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
