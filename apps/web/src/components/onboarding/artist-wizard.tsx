"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { toApiProblem, unwrap } from "@spot-on-slot/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Button,
  ChoiceChips,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRootError,
  Input,
  toast,
  translateFormError,
} from "@spot-on-slot/ui";
import { ApiErrorState } from "@/components/errors/api-error-state";
import { showServerError } from "@/components/auth/server-error";
import { api } from "@/lib/api";
import { problemMessage } from "@/lib/problem-text";
import { GENRES, MAX_GENRES } from "./options";
import { PhotoField } from "./photo-field";
import { artistRequest, type ArtistProfile, type ArtistRequest, type Genre } from "./profile-requests";
import { ARTIST_PROFILE, useArtistProfile } from "./queries";
import { SummaryBody } from "./summary-step";
import { WizardFrame } from "./wizard-frame";
import { ArtistLocationPicker } from "./artist-location-picker";

type Step = "basics" | "photo" | "location" | "summary";
const STEPS: Step[] = ["basics", "photo", "location", "summary"];

/** Where a returning artist continues: the first step that still has something missing. */
export function firstArtistStep(profile: ArtistProfile | null): number {
  if (!profile) return 0;
  const missing = new Set(profile.missingForPublication);
  if (missing.has("STAGE_NAME") || missing.has("GENRE")) return 0;
  if (missing.has("AVATAR")) return 1;
  if (missing.has("LOCATION")) return 2;
  return 3;
}

const basicsSchema = z.object({
  stageName: z.string().trim().min(1, "validation.required").max(60, "validation.tooLong"),
  genres: z.array(z.enum(GENRES)).min(1, "validation.genresRequired").max(MAX_GENRES),
});
type BasicsValues = z.infer<typeof basicsSchema>;

export function ArtistWizard() {
  const profile = useArtistProfile();
  const t = useTranslations("onboarding");
  if (profile.isPending) {
    return (
      <p role="status" className="font-display text-lg">
        {t("loading")}
      </p>
    );
  }
  if (profile.isError) return <ApiErrorState error={profile.error} onRetry={() => profile.refetch()} />;
  return <ArtistSteps profile={profile.data} initialStep={firstArtistStep(profile.data)} />;
}

function ArtistSteps({ profile, initialStep }: { profile: ArtistProfile | null; initialStep: number }) {
  const t = useTranslations("onboarding");
  const queryClient = useQueryClient();
  const [step, setStep] = useState(initialStep);
  const labels = STEPS.map((key) => t(`artist.steps.${key}`));

  // Each step saves the whole profile, merged with what is already stored (spec W2, section 2).
  const save = useMutation({
    mutationFn: async (patch: Partial<ArtistRequest>) =>
      unwrap(
        await api.PUT("/api/v1/artists/me", {
          body: artistRequest(profile, patch),
        }),
      ),
    meta: { handlesErrors: true },
    onSuccess: (saved) => queryClient.setQueryData(ARTIST_PROFILE, saved),
  });

  const frame = {
    steps: labels,
    current: step,
    onBack: step > 0 ? () => setStep(step - 1) : undefined,
  };
  const next = () => setStep((current) => Math.min(current + 1, STEPS.length - 1));

  switch (STEPS[step]) {
    case "basics":
      return <BasicsStep frame={frame} profile={profile} save={save.mutateAsync} onDone={next} />;
    case "photo":
      return <PhotoStep frame={frame} profile={profile} save={save.mutateAsync} onDone={next} />;
    case "location":
      return <LocationStep frame={frame} profile={profile} onDone={next} />;
    default:
      return <ArtistSummary frame={frame} profile={profile} />;
  }
}

interface StepProps {
  frame: { steps: string[]; current: number; onBack?: () => void };
  profile: ArtistProfile | null;
}
type Save = (patch: Partial<ArtistRequest>) => Promise<ArtistProfile>;

function BasicsStep({ frame, profile, save, onDone }: StepProps & { save: Save; onDone: () => void }) {
  const t = useTranslations();
  const form = useForm<BasicsValues>({
    resolver: zodResolver(basicsSchema),
    defaultValues: {
      stageName: profile?.stageName ?? "",
      genres: profile?.genres ?? [],
    },
  });
  const translate = translateFormError(t as Parameters<typeof translateFormError>[0]);

  async function onSubmit(values: BasicsValues) {
    try {
      await save({ stageName: values.stageName, genres: values.genres });
      onDone();
    } catch (failure) {
      showServerError(form, toApiProblem(failure), t);
    }
  }

  return (
    <Form {...form} translateError={translate}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <WizardFrame
          {...frame}
          title={t("onboarding.artist.basics.title")}
          intro={profile ? undefined : t("onboarding.artist.intro")}
          footer={
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t("onboarding.saving") : t("onboarding.next")}
            </Button>
          }
        >
          <FormField
            control={form.control}
            name="stageName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("onboarding.artist.basics.stageName")}</FormLabel>
                <FormControl>
                  <Input {...field} placeholder={t("onboarding.artist.basics.stageNamePlaceholder")} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="genres"
            render={({ field, fieldState }) => (
              <ChoiceChips<Genre>
                legend={t("onboarding.artist.basics.genres")}
                hint={t("onboarding.artist.basics.genresHint")}
                options={GENRES.map((genre) => ({
                  value: genre,
                  label: t(`genres.${genre}`),
                }))}
                value={field.value}
                onChange={field.onChange}
                max={MAX_GENRES}
                error={fieldState.error?.message ? translate(fieldState.error.message) : undefined}
              />
            )}
          />
          <FormRootError />
        </WizardFrame>
      </form>
    </Form>
  );
}

function PhotoStep({ frame, profile, save, onDone }: StepProps & { save: Save; onDone: () => void }) {
  const t = useTranslations();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function onUploaded(image: { id: string }) {
    setError(undefined);
    setSaving(true);
    try {
      await save({ avatarMediaId: image.id });
    } catch (failure) {
      setError(problemMessage(t, failure));
    } finally {
      setSaving(false);
    }
  }

  return (
    <WizardFrame
      {...frame}
      title={t("onboarding.artist.photo.title")}
      intro={t("onboarding.artist.photo.intro")}
      busy={saving}
      onNext={() => (profile?.avatar ? onDone() : setError(t("onboarding.photo.required")))}
    >
      <PhotoField previewUrl={profile?.avatar?.medium} onUploaded={onUploaded} error={error} />
    </WizardFrame>
  );
}

function LocationStep({ frame, profile, onDone }: StepProps & { onDone: () => void }) {
  const t = useTranslations();
  const [error, setError] = useState<string>();
  const label = profile?.location?.label;
  return (
    <WizardFrame
      {...frame}
      title={t("onboarding.artist.location.title")}
      intro={t("onboarding.artist.location.intro")}
      onNext={() => (label ? onDone() : setError(t("onboarding.location.required")))}
    >
      <ArtistLocationPicker error={error} onChange={() => setError(undefined)} />
      {label && (
        <p role="status" className="font-display text-base">
          {t("onboarding.artist.location.current", { label })}
        </p>
      )}
    </WizardFrame>
  );
}

function ArtistSummary({ frame, profile }: StepProps) {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const queryClient = useQueryClient();
  const missing = profile?.missingForPublication ?? ["STAGE_NAME", "GENRE", "AVATAR", "LOCATION"];

  const publish = useMutation({
    mutationFn: async () => unwrap(await api.POST("/api/v1/artists/me/publish")),
    onSuccess: (saved) => {
      queryClient.setQueryData(ARTIST_PROFILE, saved);
      toast.success(t("summary.published"));
      router.push("/dashboard");
    },
  });

  return (
    <WizardFrame
      {...frame}
      title={t("summary.title")}
      busy={publish.isPending}
      footer={
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={() => router.push("/dashboard")}>
            {t("summary.draft")}
          </Button>
          <Button type="button" onClick={() => publish.mutate()} disabled={missing.length > 0 || publish.isPending}>
            {t("summary.publish")}
          </Button>
        </div>
      }
    >
      {profile?.avatar && (
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- public WebP variant from the media module */}
          <img src={profile.avatar.small} alt="" className="size-20 border-2 border-border object-cover" />
          <div className="flex flex-col gap-1">
            <p className="font-display text-lg">{profile.stageName}</p>
            {profile.location && <p className="text-sm text-muted-foreground">{profile.location.label}</p>}
          </div>
        </div>
      )}
      <SummaryBody missing={missing} />
      <Link
        href="/profile/edit"
        className="self-start text-sm font-bold uppercase underline underline-offset-4 hover:text-primary"
      >
        {t("summary.editMore")}
      </Link>
    </WizardFrame>
  );
}
