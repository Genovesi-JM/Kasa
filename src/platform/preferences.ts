type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;
type StorageSource = () => PreferenceStorage;

// Storage can be unavailable in private or embedded browsers. Preferences must
// never prevent the app from loading or stop an in-memory language change.
export function readPreference(
  key: string,
  storage: StorageSource = () => window.localStorage,
): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

export function writePreference(
  key: string,
  value: string,
  storage: StorageSource = () => window.localStorage,
): boolean {
  try {
    storage().setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
