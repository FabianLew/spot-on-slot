"use client";

import { unwrap } from "@spot-on-slot/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button, PageHeader, Panel, PixelSquare, toast } from "@spot-on-slot/ui";
import { ApiErrorState } from "@/components/errors/api-error-state";
import { ARTIST_PROFILE, useArtistProfile } from "@/components/onboarding/queries";
import { useSession } from "@/components/session/session-provider";
import { api } from "@/lib/api";
import { ArtistProfileView } from "./artist-profile-view";

/** Where the public page of a slug lives, on this site. */
export function publicProfileUrl(slug: string) {
  return `${window.location.origin}/a/${slug}`;
}

/** The "Profil" tab: the artist's profile as others see it, with its state and actions on top. */
export function MyProfile() {
  const t = useTranslations("artistProfile.mine");
  const { session } = useSession();
  const role = session.status === "authenticated" ? session.user.role : "";

  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={t("title")} />
      {role === "ARTIST" ? (
        <ArtistSection />
      ) : (
        <Panel>
          <p className="text-sm">{role === "VENUE" ? t("venue") : t("other")}</p>
          {role === "VENUE" && (
            <Button asChild className="self-start">
              <Link href="/onboarding">{t("toWizard")}</Link>
            </Button>
          )}
        </Panel>
      )}
    </section>
  );
}

function ArtistSection() {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const profile = useArtistProfile();

  const toggle = useMutation({
    mutationFn: async (publish: boolean) =>
      unwrap(publish ? await api.POST("/api/v1/artists/me/publish") : await api.POST("/api/v1/artists/me/unpublish")),
    onSuccess: (saved) => {
      queryClient.setQueryData(ARTIST_PROFILE, saved);
      toast.success(t(saved.published ? "artistProfile.mine.publishedToast" : "artistProfile.mine.unpublishedToast"));
    },
  });

  if (profile.isPending) return <Panel aria-busy="true" className="h-40" />;
  if (profile.isError) return <ApiErrorState error={profile.error} onRetry={() => profile.refetch()} />;
  const data = profile.data;
  if (!data) {
    return (
      <Panel>
        <p className="text-sm">{t("artistProfile.mine.none")}</p>
        <Button asChild className="self-start">
          <Link href="/onboarding">{t("artistProfile.mine.start")}</Link>
        </Button>
      </Panel>
    );
  }

  async function copyLink() {
    const url = publicProfileUrl(data!.slug);
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("artistProfile.mine.copied"));
    } catch {
      toast.error(t("artistProfile.mine.copyFailed", { url }));
    }
  }

  const missing = data.missingForPublication;
  return (
    <>
      <Panel className={data.published ? undefined : "border-primary"}>
        <p className="flex items-center gap-3 text-sm">
          <PixelSquare className={data.published ? "size-4 shrink-0 text-highlight" : "size-4 shrink-0 text-primary"} />
          {t(data.published ? "artistProfile.mine.published" : "artistProfile.mine.draft")}
        </p>
        {!data.published && missing.length > 0 && (
          <p className="text-sm">
            {t("artistProfile.mine.missingTitle")} {missing.map((item) => t(`onboarding.missing.${item}`)).join(", ")}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/profile/edit">{t("artistProfile.mine.edit")}</Link>
          </Button>
          {data.published ? (
            <>
              <Button type="button" variant="outline" onClick={copyLink}>
                {t("artistProfile.mine.copyLink")}
              </Button>
              <Button asChild variant="outline">
                <a href={`/a/${data.slug}`} target="_blank" rel="noopener noreferrer">
                  {t("artistProfile.mine.open")}
                </a>
              </Button>
              <Button type="button" variant="ghost" onClick={() => toggle.mutate(false)} disabled={toggle.isPending}>
                {t("artistProfile.mine.unpublish")}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => toggle.mutate(true)}
              disabled={missing.length > 0 || toggle.isPending}
            >
              {t("artistProfile.mine.publish")}
            </Button>
          )}
        </div>
      </Panel>
      <ArtistProfileView profile={data} />
    </>
  );
}
