// Generic, dependency-free helpers shared across the UI and API layers.

export function generateRandomNonce() {
  const globalCrypto = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID();
  }
  if (globalCrypto?.getRandomValues) {
    const buffer = new Uint32Array(4);
    globalCrypto.getRandomValues(buffer);
    return Array.from(buffer, (value) => value.toString(16).padStart(8, '0')).join('');
  }
  return Math.random().toString(36).slice(2);
}

export function pickFirstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value) {
      return value;
    }
  }
  return '';
}

export function getErrorMessage(error, fallback = 'Unknown error') {
  return error instanceof Error ? error.message : fallback;
}

export async function readApiErrorMessage(response, fallback) {
  const rawText = await response.text().catch(() => '');
  if (!rawText) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(rawText);
    return pickFirstString(parsed?.message, parsed?.error, parsed?.details, parsed?.hint)
      || JSON.stringify(parsed);
  } catch (_) {
    return rawText;
  }
}

export async function copyTextToClipboard(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document === 'undefined') return;

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
}
