import Script from "next/script";

const DEFAULT_SCRIPT_URL = "https://cloud.umami.is/script.js";

/**
 * Umami page statistics: no cookies and no stored identifiers, so no consent banner. Loads only
 * when `NEXT_PUBLIC_UMAMI_WEBSITE_ID` is set; clicks on elements with `data-umami-event` count as events.
 */
export function Umami() {
  // Direct property access so Next inlines the NEXT_PUBLIC_ values at build time.
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID?.trim();
  const src = process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL?.trim() || DEFAULT_SCRIPT_URL;
  if (!websiteId) return null;
  return <Script src={src} data-website-id={websiteId} strategy="afterInteractive" />;
}
