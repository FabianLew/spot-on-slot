type Umami = { track: (event: string, data?: Record<string, string>) => void };

/** Sends a custom Umami event; does nothing when the script is not loaded (dev, tests, blockers). */
export function trackEvent(event: string, data?: Record<string, string>) {
  (globalThis as { umami?: Umami }).umami?.track(event, data);
}
