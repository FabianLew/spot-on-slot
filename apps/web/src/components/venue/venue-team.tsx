"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { toApiProblem, unwrap, type ApiSchemas } from "@spot-on-slot/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRootError,
  Panel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
  translateFormError,
} from "@spot-on-slot/ui";
import { AuthField } from "@/components/auth/auth-field";
import { showServerError } from "@/components/auth/server-error";
import { ApiErrorState } from "@/components/errors/api-error-state";
import type { Venue } from "@/components/onboarding/profile-requests";
import { dropVenue } from "@/components/onboarding/queries";
import { useSession } from "@/components/session/session-provider";
import { api } from "@/lib/api";
import { problemMessage } from "@/lib/problem-text";
import { VenueLoader } from "./venue-form";

type Team = ApiSchemas["VenueTeam"];
type Role = ApiSchemas["VenueTeamMember"]["role"];
const ROLES: Role[] = ["MANAGER", "OWNER"];

const teamKey = (id: string) => ["venues", id, "team"] as const;

/** `/profile/venues/{id}/team`: members and pending invitations; owners invite and remove, anyone may leave. */
export function VenueTeam({ id }: { id: string }) {
  const t = useTranslations("venueProfile.team");
  return (
    <VenueLoader id={id} title={t("title")}>
      {(venue) => <TeamPanels venue={venue} />}
    </VenueLoader>
  );
}

function TeamPanels({ venue }: { venue: Venue }) {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const me = session.status === "authenticated" ? session.user.id : "";
  const owner = venue.role === "OWNER";
  const [error, setError] = useState<string>();

  const team = useQuery({
    queryKey: teamKey(venue.id),
    queryFn: async (): Promise<Team> =>
      unwrap(await api.GET("/api/v1/venues/{id}/team", { params: { path: { id: venue.id } } })),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: teamKey(venue.id) });

  const revoke = useMutation({
    mutationFn: async (invitationId: string) =>
      unwrap(
        await api.DELETE("/api/v1/venues/{id}/team/invitations/{invitationId}", {
          params: { path: { id: venue.id, invitationId } },
        }),
      ),
    meta: { handlesErrors: true },
    onMutate: () => setError(undefined),
    onSuccess: () => {
      toast.success(t("venueProfile.team.revoked"));
      return refresh();
    },
    onError: (failure) => setError(problemMessage(t, failure)),
  });

  const remove = useMutation({
    mutationFn: async (userId: string) =>
      unwrap(
        await api.DELETE("/api/v1/venues/{id}/team/{userId}", {
          params: { path: { id: venue.id, userId } },
        }),
      ),
    meta: { handlesErrors: true },
    onMutate: () => setError(undefined),
    onSuccess: (_, userId) => {
      if (userId === me) {
        dropVenue(queryClient, venue.id);
        toast.success(t("venueProfile.team.left", { name: venue.name }));
        router.push("/profile");
        return;
      }
      toast.success(t("venueProfile.team.removed"));
      return refresh();
    },
    onError: (failure) => setError(problemMessage(t, failure)),
  });

  if (team.isPending) return <Panel aria-busy="true" className="h-40" />;
  if (team.isError) return <ApiErrorState error={team.error} onRetry={() => team.refetch()} />;
  const { members, invitations } = team.data;
  const owners = members.filter((member) => member.role === "OWNER").length;
  const lastOwner = owner && owners <= 1;
  const date = (iso: string) => format.dateTime(new Date(iso), { day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      <Panel title={t("venueProfile.team.members")}>
        <ul aria-label={t("venueProfile.team.members")} className="flex flex-col divide-y-2 divide-border">
          {members.map((member) => {
            const self = member.userId === me;
            const email = member.email ?? t("venueProfile.team.noEmail");
            return (
              <li key={member.userId} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0">
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="text-sm font-bold break-all">{email}</p>
                  <p className="text-xs uppercase text-muted-foreground">
                    {t(`venueProfile.role.${member.role}`)} ·{" "}
                    {t("venueProfile.team.joined", { date: date(member.joinedAt) })}
                    {self && <span className="ml-2 text-primary">{t("venueProfile.team.you")}</span>}
                  </p>
                </div>
                {owner && !self && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label={t("venueProfile.team.removeLabel", { email })}
                    disabled={remove.isPending}
                    onClick={() => {
                      if (window.confirm(t("venueProfile.team.removeConfirm", { email }))) remove.mutate(member.userId);
                    }}
                  >
                    {t("venueProfile.team.remove")}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        <div className="flex flex-col gap-2 border-t-2 border-border pt-3">
          <Button
            type="button"
            variant="ghost"
            className="self-start"
            disabled={lastOwner || remove.isPending}
            onClick={() => {
              if (window.confirm(t("venueProfile.team.leaveConfirm", { name: venue.name }))) remove.mutate(me);
            }}
          >
            {t("venueProfile.team.leave")}
          </Button>
          {lastOwner && <p className="text-xs text-muted-foreground">{t("venueProfile.team.lastOwner")}</p>}
        </div>
      </Panel>

      <Panel title={t("venueProfile.team.invitations")}>
        {invitations.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("venueProfile.team.noInvitations")}</p>
        ) : (
          <ul aria-label={t("venueProfile.team.invitations")} className="flex flex-col divide-y-2 divide-border">
            {invitations.map((invitation) => (
              <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0">
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="text-sm font-bold break-all">{invitation.email}</p>
                  <p className="text-xs uppercase text-muted-foreground">
                    {t(`venueProfile.role.${invitation.role}`)} ·{" "}
                    {t("venueProfile.team.expires", { date: date(invitation.expiresAt) })}
                  </p>
                </div>
                {owner && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label={t("venueProfile.team.revokeLabel", { email: invitation.email })}
                    disabled={revoke.isPending}
                    onClick={() => revoke.mutate(invitation.id)}
                  >
                    {t("venueProfile.team.revoke")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {owner ? (
        <InviteForm venueId={venue.id} onInvited={refresh} />
      ) : (
        <p className="text-sm text-muted-foreground">{t("venueProfile.team.managerNote")}</p>
      )}
    </>
  );
}

const inviteSchema = z.object({
  email: z.string().trim().min(1, "validation.required").email("validation.email").max(254, "validation.tooLong"),
  role: z.enum(["MANAGER", "OWNER"]),
});
type InviteValues = z.infer<typeof inviteSchema>;

function InviteForm({ venueId, onInvited }: { venueId: string; onInvited: () => Promise<unknown> }) {
  const t = useTranslations();
  const form = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role: "MANAGER" },
  });

  const role = useWatch({ control: form.control, name: "role" });

  async function onSubmit(values: InviteValues) {
    try {
      const sent = unwrap(
        await api.POST("/api/v1/venues/{id}/team/invitations", {
          params: { path: { id: venueId } },
          body: { email: values.email.trim(), role: values.role },
        }),
      );
      toast.success(t("venueProfile.team.sent", { email: sent.email }));
      form.reset();
      await onInvited();
    } catch (failure) {
      showServerError(form, toApiProblem(failure), t);
    }
  }

  return (
    <Panel title={t("venueProfile.team.invite")}>
      <Form {...form} translateError={translateFormError(t as Parameters<typeof translateFormError>[0])}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <p className="text-xs text-muted-foreground">{t("venueProfile.team.inviteHint")}</p>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr] sm:items-end">
            <AuthField
              control={form.control}
              name="email"
              label={t("venueProfile.team.email")}
              type="email"
              autoComplete="off"
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("venueProfile.team.role")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {t(`venueProfile.role.${role}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">{t(`venueProfile.team.roleHint.${role}`)}</p>
          <FormRootError />
          <Button type="submit" className="self-start" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? t("venueProfile.team.sending") : t("venueProfile.team.send")}
          </Button>
        </form>
      </Form>
    </Panel>
  );
}
