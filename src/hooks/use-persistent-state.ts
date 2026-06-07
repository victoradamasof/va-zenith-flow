import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";

export function usePersistentState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const [ready, setReady] = useState(false);
  const serializedRef = useRef("");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored) {
        serializedRef.current = stored;
        setValue(JSON.parse(stored) as T);
      } else {
        serializedRef.current = JSON.stringify(initialValue);
      }
    } catch (error) {
      console.warn(`Could not read persisted state for ${key}`, error);
    } finally {
      setReady(true);
    }
  }, [key]);

  useEffect(() => {
    const readPersistedValue = () => {
      try {
        const stored = window.localStorage.getItem(key);
        if (stored) {
          serializedRef.current = stored;
          setValue(JSON.parse(stored) as T);
        } else {
          serializedRef.current = JSON.stringify(initialValue);
          setValue(initialValue);
        }
      } catch (error) {
        console.warn(`Could not refresh persisted state for ${key}`, error);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== key) return;
      readPersistedValue();
    };

    const handleLocalWrite = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string }>).detail;
      if (detail?.key && detail.key !== key) return;
      readPersistedValue();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("va-manager:local-write", handleLocalWrite);
    window.addEventListener("va-manager:cloud-data-applied", readPersistedValue);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("va-manager:local-write", handleLocalWrite);
      window.removeEventListener("va-manager:cloud-data-applied", readPersistedValue);
    };
  }, [initialValue, key]);

  useEffect(() => {
    if (!ready) return;
    try {
      const serialized = JSON.stringify(value);
      if (serializedRef.current === serialized) return;
      serializedRef.current = serialized;
      window.localStorage.setItem(key, serialized);
    } catch (error) {
      console.warn(`Could not persist state for ${key}`, error);
    }
  }, [key, ready, value]);

  return [value, setValue, ready] as const satisfies readonly [
    T,
    Dispatch<SetStateAction<T>>,
    boolean,
  ];
}
