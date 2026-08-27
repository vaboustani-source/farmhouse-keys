/** Canonical public origin for guest-facing links (booking pages, trackers,
 * payment-update links). Admin sessions often run on the Lovable preview or
 * editor domain — links copied or displayed there must never carry that
 * host. Localhost keeps its own origin so local testing still works. */
export const PUBLIC_BASE_URL = "https://stay.gilbertsvillefarmhouse.com";

export function publicUrl(path: string): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return `${window.location.origin}${path}`;
    }
  }
  return `${PUBLIC_BASE_URL}${path}`;
}
