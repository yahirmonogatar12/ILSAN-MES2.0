import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { readStorage, writeStorage } from "../lib/storage";

/** Decode persisted input at its boundary. Scope the key by mode/user as needed. */
export function usePersistentState<T>(
  key: string,
  fallback: T,
  decode: (value: unknown) => T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() =>
    decode(readStorage<unknown>(key, fallback)),
  );
  useEffect(() => {
    writeStorage(key, value);
  }, [key, value]);
  return [value, setValue];
}
