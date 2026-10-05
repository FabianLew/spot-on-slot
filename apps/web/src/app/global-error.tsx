"use client";

import messages from "../../messages/pl.json";

// Replaces the root layout, so no providers or global styles are available: static Polish copy.
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="pl">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1rem", maxWidth: "28rem", margin: "0 auto" }}>
        <h1>{messages.errors.title}</h1>
        <p>{messages.errors.INTERNAL_ERROR}</p>
        <button type="button" onClick={() => retry()} style={{ padding: "0.5rem 1rem", fontSize: "1rem" }}>
          {messages.errors.retry}
        </button>
      </body>
    </html>
  );
}
