// Safe localStorage wrapper: guards against SSR (no window) and swallows
// quota/security errors so callers don't need repetitive try/catch blocks.

export const safeStorage = {
  get(key) {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  },
  set(key, value) {
    if (typeof window === 'undefined') return false;
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (_) {
      return false;
    }
  },
  remove(key) {
    if (typeof window === 'undefined') return false;
    try {
      window.localStorage.removeItem(key);
      return true;
    } catch (_) {
      return false;
    }
  },
};
