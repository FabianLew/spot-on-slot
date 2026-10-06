import { useFormatter, useTranslations } from "next-intl";
import { dayDate, local } from "@/components/calendar/warsaw-time";

/** Grosze as whole złote. */
export const zl = (grosze: number) => Math.round(grosze / 100);

/** "pt., 23 października · 22:00–04:00 +1" in Warsaw time. */
export function useTermText() {
  const format = useFormatter();
  const t = useTranslations("listings");
  return (startsAt: string, endsAt: string) => {
    const start = local(startsAt);
    const end = local(endsAt);
    const day = format.dateTime(dayDate(start.day), { weekday: "short", day: "numeric", month: "long" });
    const next = end.day !== start.day ? ` ${t("nextDay")}` : "";
    return `${day} · ${start.time}–${end.time}${next}`;
  };
}

/** "800–1500 zł", "od 800 zł", "do 1500 zł", or "do ustalenia". */
export function usePriceText() {
  const t = useTranslations("listings.price");
  const format = useFormatter();
  const amount = (grosze: number) => format.number(zl(grosze));
  return (from?: number | null, to?: number | null) => {
    if (from != null && to != null) return t("range", { from: amount(from), to: amount(to) });
    if (from != null) return t("from", { amount: amount(from) });
    if (to != null) return t("to", { amount: amount(to) });
    return t("open");
  };
}
