declare global {
  var GOOGLE_MAPS_API_KEY: string | undefined;
}

declare const __GOOGLE_MAPS_API_KEY__: string | undefined;

export function getGoogleMapsApiKey(): string {
  return (
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    (typeof __GOOGLE_MAPS_API_KEY__ !== 'undefined' ? __GOOGLE_MAPS_API_KEY__ : '') ||
    globalThis.GOOGLE_MAPS_API_KEY ||
    ''
  );
}

export function triggerQuotaExceededNotice(): void {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
}

export function isGoogleMapsQuotaError(error: unknown): boolean {
  if (!error) return false;
  const text =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === 'object'
        ? JSON.stringify(error)
        : String(error);

  return (
    text.includes('RESOURCE_EXHAUSTED') ||
    text.includes('OVER_QUERY_LIMIT') ||
    text.includes('OverQuotaMapError') ||
    text.includes('QuotaExceededError') ||
    /\b429\b/.test(text)
  );
}
