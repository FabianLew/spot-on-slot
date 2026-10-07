import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Spot On Slot";

// Satori reads WOFF, not WOFF2; latin-ext carries the Polish letters.
function font(file: string) {
  return readFile(join(process.cwd(), "node_modules/@fontsource/silkscreen/files", file));
}

/** The link preview: the hero's yellow café with the headline on black labels, as on the landing. */
export default async function OpenGraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "hero" });
  const [background, latin, latinExt] = await Promise.all([
    readFile(join(process.cwd(), "src/assets/og-cafe.jpg")),
    font("silkscreen-latin-400-normal.woff"),
    font("silkscreen-latin-ext-400-normal.woff"),
  ]);
  const label = {
    display: "flex",
    backgroundColor: "#000000",
    padding: "8px 20px",
    fontSize: 64,
    boxShadow: "8px 8px 0 0 #ff261f",
  } as const;

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", position: "relative", fontFamily: "Silkscreen" }}>
        <img
          src={`data:image/jpeg;base64,${background.toString("base64")}`}
          width={size.width}
          height={size.height}
          alt=""
          style={{ position: "absolute", inset: 0 }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 56,
            width: "100%",
            height: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16, backgroundColor: "#000000", padding: "10px 18px", alignSelf: "flex-start", border: "4px solid #ffd400" }}>
            <svg width="40" height="40" viewBox="0 0 256 256" fill="#ffd400">
              <path d="M 256 256 L 128 256 L 0 128 L 128 128 Z M 256 128 L 128 128 L 0 0 L 128 0 Z" />
            </svg>
            <span style={{ fontSize: 36, color: "#ffd400" }}>{t("brand")}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 20 }}>
            <span style={{ ...label, color: "#ffffff" }}>{t("headlineLine1")}</span>
            <span style={{ ...label, color: "#ffd400" }}>{t("headlineLine2")}</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Silkscreen", data: latin, weight: 400, style: "normal" },
        { name: "Silkscreen", data: latinExt, weight: 400, style: "normal" },
      ],
    },
  );
}
