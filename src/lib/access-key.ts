const STORE = "isabot.accessKey";

export function getStoredKey(): string | null {
  try {
    return window.localStorage.getItem(STORE);
  } catch {
    return null;
  }
}

export function storeKey(key: string) {
  try {
    window.localStorage.setItem(STORE, key);
  } catch {
    /* almacenamiento bloqueado */
  }
}

export function clearStoredKey() {
  try {
    window.localStorage.removeItem(STORE);
  } catch {
    /* noop */
  }
}
