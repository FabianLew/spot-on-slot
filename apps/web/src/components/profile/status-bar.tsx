"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { Button, Panel, PixelSquare, toast } from "@spot-on-slot/ui";
import type { ArtistProfile, Venue } from "@/components/onboarding/profile-requests";

type Requirement = ArtistProfile["missingForPublication"][number] | Venue["missingForPublication"][number];

interface StatusBarProps {
  published: boolean;
  /** What is still missing for publication (named by `onboarding.missing.*`). */
  missing: Requirement[];
  /** Site path of the public page, e.g. `/a/weronika`. */
  publicPath: string;
  draftText: string;
  publishedText: string;
  edit: { href: string; label: string };
  onToggle: (publish: boolean) => void;
  toggling: boolean;
  /** Without it the publish buttons are disabled with a note (only venue owners publish). */
  canToggle?: boolean;
  /** Set while an admin keeps the profile hidden: it cannot be published until they restore it. */
  moderation?: { reason: string } | null;
  /** More actions next to "Edit". */
  children?: ReactNode;
}

/** The state of an own profile on top of its preview: draft or published, what is missing, and the actions. */
export function StatusBar({
  published,
  missing,
  publicPath,
  draftText,
  publishedText,
  edit,
  onToggle,
  toggling,
  canToggle = true,
  moderation,
  children,
}: StatusBarProps) {
  const t = useTranslations();

  async function copyLink() {
    const url = `${window.location.origin}${publicPath}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("profileStatus.copied"));
    } catch {
      toast.error(t("profileStatus.copyFailed", { url }));
    }
  }

  return (
    <Panel className={published ? undefined : "border-primary"}>
      <p className="flex items-center gap-3 text-sm">
        <PixelSquare className={published ? "size-4 shrink-0 text-highlight" : "size-4 shrink-0 text-primary"} />
        {published ? publishedText : draftText}
      </p>
      {moderation != null && (
        <div role="alert" className="flex gap-3 border-2 border-danger p-3 text-sm">
          <CircleAlert className="size-5 shrink-0 text-danger" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <p className="font-bold text-danger">{t("profileStatus.hidden")}</p>
            <p>{t("profileStatus.hiddenReason", { reason: moderation.reason })}</p>
            <p className="text-muted-foreground">{t("profileStatus.hiddenHelp")}</p>
          </div>
        </div>
      )}
      {!published && missing.length > 0 && (
        <p className="text-sm">
          {t("profileStatus.missingTitle")} {missing.map((item) => t(`onboarding.missing.${item}`)).join(", ")}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href={edit.href}>{edit.label}</Link>
        </Button>
        {children}
        {published ? (
          <>
            <Button type="button" variant="outline" onClick={copyLink}>
              {t("profileStatus.copyLink")}
            </Button>
            <Button asChild variant="outline">
              <a href={publicPath} target="_blank" rel="noopener noreferrer">
                {t("profileStatus.open")}
              </a>
            </Button>
            <Button type="button" variant="ghost" onClick={() => onToggle(false)} disabled={!canToggle || toggling}>
              {t("profileStatus.unpublish")}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => onToggle(true)}
            disabled={!canToggle || missing.length > 0 || toggling || moderation != null}
          >
            {t("profileStatus.publish")}
          </Button>
        )}
      </div>
      {!canToggle && <p className="text-xs text-muted-foreground">{t("profileStatus.ownerOnly")}</p>}
    </Panel>
  );
}
