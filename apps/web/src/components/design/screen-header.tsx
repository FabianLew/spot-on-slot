import Link from "next/link";
import { useTranslations } from "next-intl";
import { MoreHorizontal } from "pixelarticons/react/MoreHorizontal";
import { PageHeader } from "@spot-on-slot/ui";

/** "‹ TITLE ···" bar of the mockup screens; back goes to the design preview index. */
export function ScreenHeader({ title }: { title: string }) {
  const t = useTranslations("design");
  return (
    <PageHeader
      title={title}
      back={
        <Link
          href="/design"
          aria-label={t("back")}
          className="font-display flex size-10 items-center justify-center text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ‹
        </Link>
      }
      actions={
        <button
          type="button"
          aria-label={t("moreActions")}
          className="flex size-10 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MoreHorizontal className="size-5" aria-hidden="true" />
        </button>
      }
    />
  );
}
