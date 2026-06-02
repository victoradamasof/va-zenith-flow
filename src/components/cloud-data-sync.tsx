"use client";

import { useEffect, useRef } from "react";
import { exportAllLocalData, replaceAllLocalData, type CloudDataSnapshot } from "@/lib/data-management";

type CloudPayload = {
  updatedAt: string;
  data: CloudDataSnapshot;
};

const markerKey = "va-manager:cloud-updated-at";
const localWriteEvent = "va-manager:local-write";

declare global {
  interface Window {
    __vaCloudBridgeInstalled?: boolean;
  }
}

function shouldSyncKey(key: string) {
  return key.startsWith("va-manager:") && key !== markerKey && key !== "va-manager:auth-session";
}

function installLocalStorageBridge() {
  if (window.__vaCloudBridgeInstalled) return;

  const storage = window.localStorage;
  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;

  window.__vaCloudBridgeInstalled = true;

  Object.defineProperty(storage, "setItem", {
    configurable: true,
    value: (key: string, value: string) => {
      originalSetItem.call(storage, key, value);
      if (shouldSyncKey(key)) {
        window.dispatchEvent(new CustomEvent(localWriteEvent, { detail: { key } }));
      }
    },
  });

  Object.defineProperty(storage, "removeItem", {
    configurable: true,
    value: (key: string) => {
      originalRemoveItem.call(storage, key);
      if (shouldSyncKey(key)) {
        window.dispatchEvent(new CustomEvent(localWriteEvent, { detail: { key } }));
      }
    },
  });
}

async function fetchCloudPayload(): Promise<CloudPayload | null> {
  const response = await fetch("/api/cloud-data", {
    headers: { accept: "application/json" },
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Cloud sync failed: ${response.status}`);

  const payload = (await response.json()) as CloudPayload | null;
  return payload?.data ? payload : null;
}

async function saveCloudPayload(data: CloudDataSnapshot) {
  const response = await fetch("/api/cloud-data", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data }),
  });

  if (!response.ok) throw new Error(`Cloud save failed: ${response.status}`);

  const payload = (await response.json()) as CloudPayload;
  window.localStorage.setItem(markerKey, payload.updatedAt);
}

export function CloudDataSync() {
  const hydratedRef = useRef(false);
  const importingRef = useRef(false);
  const uploadTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    installLocalStorageBridge();

    let cancelled = false;

    const boot = async () => {
      try {
        const remote = await fetchCloudPayload();
        if (cancelled) return;

        if (remote?.data) {
          const localMarker = window.localStorage.getItem(markerKey);
          if (remote.updatedAt !== localMarker) {
            importingRef.current = true;
            replaceAllLocalData(remote.data);
            window.localStorage.setItem(markerKey, remote.updatedAt);
            importingRef.current = false;
            window.location.reload();
            return;
          }
        } else {
          await saveCloudPayload(exportAllLocalData());
        }
      } catch (error) {
        console.warn("Cloud sync unavailable", error);
      } finally {
        hydratedRef.current = true;
      }
    };

    void boot();

    const queueUpload = () => {
      if (!hydratedRef.current || importingRef.current) return;

      if (uploadTimerRef.current) {
        window.clearTimeout(uploadTimerRef.current);
      }

      uploadTimerRef.current = window.setTimeout(() => {
        void saveCloudPayload(exportAllLocalData()).catch((error) => {
          console.warn("Could not save cloud data", error);
        });
      }, 900);
    };

    window.addEventListener(localWriteEvent, queueUpload);

    return () => {
      cancelled = true;
      window.removeEventListener(localWriteEvent, queueUpload);
      if (uploadTimerRef.current) {
        window.clearTimeout(uploadTimerRef.current);
      }
    };
  }, []);

  return null;
}
