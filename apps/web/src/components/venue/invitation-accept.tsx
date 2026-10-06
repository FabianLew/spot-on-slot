"use client";

import { unwrap } from "@spot-on-slot/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Panel, toast } from "@spot-on-slot/ui";
import { storeVenue } from "@/components/onboarding/queries";
import { useSession } from "@/components/session/session-provider";
import { api } from "@/lib/api";
import { problemMessage } from "@/lib/problem-text";

/**
 * `/venue-invitation?token=`, the link from the invitation e-mail. The page sits behind sign-in, so the person is
 * known here; joining is one click, and a refused invitation (expired, revoked, another address) can switch accounts.
 */
export function InvitationAccept({ token }: { token: string | undefined }) {
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session, signOut } = useSession();
  const email = session.status === "authenticated" ? session.user.email : "";

  const accept = useMutation({
    mutationFn: async (value: string) =>
      unwrap(await api.POST("/api/v1/venues/invitations/accept", { body: { token: value } })),
    meta: { handlesErrors: true },
    onSuccess: (venue) => {
      storeVenue(queryClient, venue);
      toast.success(t("venueProfile.invitation.accepted", { name: venue.name }));
      router.push(`/profile?venue=${venue.id}`);
    },
  });

  return (
    <Panel title={t("venueProfile.invitation.title")}>
      {!token ? (
        <p className="text-sm">{t("venueProfile.invitation.missingToken")}</p>
      ) : (
        <>
          <p className="text-sm">{t("venueProfile.invitation.text", { email })}</p>
          {accept.isError && (
            <div role="alert" className="flex flex-col gap-2 text-sm">
              <p className="flex items-start gap-2 text-danger">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {problemMessage(t, accept.error)}
              </p>
              <p>{t("venueProfile.invitation.otherAccount")}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            {!accept.isError && (
              <Button type="button" disabled={accept.isPending} onClick={() => accept.mutate(token)}>
                {accept.isPending ? t("venueProfile.invitation.accepting") : t("venueProfile.invitation.accept")}
              </Button>
            )}
            {accept.isError && (
              <Button type="button" variant="outline" onClick={() => void signOut()}>
                {t("venueProfile.invitation.signOut")}
              </Button>
            )}
          </div>
        </>
      )}
      <Button asChild variant="ghost" className="self-start">
        <Link href="/dashboard">{t("venueProfile.invitation.toDashboard")}</Link>
      </Button>
    </Panel>
  );
}
