import { useState } from 'react';

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options?: {
    filter?: (value: T) => T
  },
) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (!item) return initialValue;
      try {
        return JSON.parse(item);
      } catch (e) {
        console.error(`Error parsing localStorage key "${key}":`, e);
        // Value is corrupted, remove it to avoid white screen loops
        window.localStorage.removeItem(key);
        return initialValue;
      }
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      const filteredValue = options?.filter ? options.filter(valueToStore) : valueToStore;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(filteredValue));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue] as const;
}
