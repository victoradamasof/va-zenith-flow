import { Dispatch, SetStateAction, useEffect, useState } from "react";

export function usePersistentState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored) {
        setValue(JSON.parse(stored) as T);
      }
    } catch (error) {
      console.warn(`Could not read persisted state for ${key}`, error);
    } finally {
      setReady(true);
    }
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
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
