import { unwrap } from "@spot-on-slot/api-client";
import { today } from "@/components/calendar/warsaw-time";
import { api } from "@/lib/api";

/** The name the backend sends; readable only when the API exposes Content-Disposition, hence the fallback. */
export function exportFileName(disposition: string | null, now: Date = new Date()): string {
  const match = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  return match?.[1] ? decodeURIComponent(match[1]) : `spot-on-slot-dane-${today(now)}.json`;
}

/** Fetches `GET /me/export` and hands the file to the browser as a download. */
export async function downloadPersonalData(): Promise<void> {
  const result = await api.GET("/api/v1/me/export", { parseAs: "blob" });
  const blob = unwrap(result) as unknown as Blob;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = exportFileName(result.response.headers.get("Content-Disposition"));
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked a moment later: some browsers start reading the blob only after the click returns.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
