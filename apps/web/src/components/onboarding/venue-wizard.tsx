"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { toApiProblem, unwrap } from "@spot-on-slot/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
  translateFormError,
} from "@spot-on-slot/ui";
import { showServerError } from "@/components/auth/server-error";
import { ApiErrorState } from "@/components/errors/api-error-state";
import { api } from "@/lib/api";
import { problemMessage } from "@/lib/problem-text";
import { GENRES, MAX_GENRES, VENUE_TYPES } from "./options";
import { PhotoField } from "./photo-field";
import { venueRequest, type Genre, type Venue, type VenueRequest } from "./profile-requests";
import { storeVenue, useMyVenues } from "./queries";
import { SummaryBody } from "./summary-step";
import { located, VenueAddressFields, type Point } from "./venue-address-fields";
import { WizardFrame } from "./wizard-frame";

type Step = "basics" | "address" | "music" | "summary";
const STEPS: Step[] = ["basics", "address", "music", "summary"];

/** Where a returning venue continues: the first step that still has something missing. */
export function firstVenueStep(venue: Venue | null): number {
  if (!venue) return 0;
  const missing = new Set(venue.missingForPublication);
  if (missing.has("NAME") || missing.has("TYPE")) return 0;
  if (missing.has("ADDRESS")) return 1;
  if (missing.has("GENRE") || missing.has("AVATAR")) return 2;
  return 3;
}

const basicsSchema = z.object({
  name: z.string().trim().min(1, "validation.required").max(120, "validation.tooLong"),
  type: z.enum(VENUE_TYPES, "validation.required"),
});
type BasicsValues = z.infer<typeof basicsSchema>;

const addressSchema = z.object({
  street: z.string().trim().min(1, "validation.required").max(120, "validation.tooLong"),
  postalCode: z.string().trim().max(12, "validation.tooLong"),
  city: z.string().trim().min(1, "validation.required").max(120, "validation.tooLong"),
});
type AddressValues = z.infer<typeof addressSchema>;

/**
 * The wizard sets up the account's first venue, or with `fresh` another one ("Dodaj lokal"); it then follows the
 * venue its first save created.
 */
export function VenueWizard({ fresh = false }: { fresh?: boolean }) {
  const venues = useMyVenues();
  const t = useTranslations("onboarding");
  const [createdId, setCreatedId] = useState<string>();
  if (venues.isPending) {
    return (
      <p role="status" className="font-display text-lg">
        {t("loading")}
      </p>
    );
  }
  if (venues.isError) return <ApiErrorState error={venues.error} onRetry={() => venues.refetch()} />;
  const venue = fresh ? (venues.data.find((item) => item.id === createdId) ?? null) : (venues.data[0] ?? null);
  return (
    <VenueSteps
      venue={venue}
      initialStep={fresh ? 0 : firstVenueStep(venue)}
      onCreated={setCreatedId}
      exitTo={(saved) => (fresh && saved ? `/profile?venue=${saved.id}` : "/dashboard")}
    />
  );
}

interface StepsProps {
  venue: Venue | null;
  initialStep: number;
  onCreated: (id: string) => void;
  /** Where the summary leaves to. */
  exitTo: (venue: Venue | null) => string;
}

function VenueSteps({ venue, initialStep, onCreated, exitTo }: StepsProps) {
  const t = useTranslations("onboarding");
  const queryClient = useQueryClient();
  const [step, setStep] = useState(initialStep);

  // The first save creates the venue; later ones replace it whole, merged with what is stored.
  const save = useMutation({
    mutationFn: async (patch: Partial<VenueRequest>) => {
      const body = venueRequest(venue, patch);
      return venue
        ? unwrap(
            await api.PUT("/api/v1/venues/{id}", {
              params: { path: { id: venue.id } },
              body,
            }),
          )
        : unwrap(await api.POST("/api/v1/venues", { body }));
    },
    meta: { handlesErrors: true },
    onSuccess: (saved) => {
      storeVenue(queryClient, saved);
      onCreated(saved.id);
    },
  });

  const frame = {
    steps: STEPS.map((key) => t(`venue.steps.${key}`)),
    current: step,
    onBack: step > 0 ? () => setStep(step - 1) : undefined,
  };
  const next = () => setStep((current) => Math.min(current + 1, STEPS.length - 1));

  switch (STEPS[step]) {
    case "basics":
      return <BasicsStep frame={frame} venue={venue} save={save.mutateAsync} onDone={next} />;
    case "address":
      return <AddressStep frame={frame} venue={venue} save={save.mutateAsync} onDone={next} />;
    case "music":
      return <MusicStep frame={frame} venue={venue} save={save.mutateAsync} onDone={next} />;
    default:
      return <VenueSummary frame={frame} venue={venue} exitTo={exitTo(venue)} />;
  }
}

interface StepProps {
  frame: { steps: string[]; current: number; onBack?: () => void };
  venue: Venue | null;
}
type Save = (patch: Partial<VenueRequest>) => Promise<Venue>;
type EditStepProps = StepProps & { save: Save; onDone: () => void };

function NextButton({ busy }: { busy: boolean }) {
  const t = useTranslations("onboarding");
  return (
    <Button type="submit" disabled={busy}>
      {busy ? t("saving") : t("next")}
    </Button>
  );
}

function BasicsStep({ frame, venue, save, onDone }: EditStepProps) {
  const t = useTranslations();
  const form = useForm<BasicsValues>({
    resolver: zodResolver(basicsSchema),
    // No type is preselected, so nobody publishes a bar as a club by accident.
    defaultValues: { name: venue?.name ?? "", type: venue?.type },
  });

  async function onSubmit(values: BasicsValues) {
    try {
      await save({ name: values.name, type: values.type });
      onDone();
    } catch (failure) {
      showServerError(form, toApiProblem(failure), t);
    }
  }

  return (
    <Form {...form} translateError={translateFormError(t as Parameters<typeof translateFormError>[0])}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <WizardFrame
          {...frame}
          title={t("onboarding.venue.basics.title")}
          intro={venue ? undefined : t("onboarding.venue.intro")}
          footer={<NextButton busy={form.formState.isSubmitting} />}
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("onboarding.venue.basics.name")}</FormLabel>
                <FormControl>
                  <Input {...field} placeholder={t("onboarding.venue.basics.namePlaceholder")} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("onboarding.venue.basics.type")}</FormLabel>
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("onboarding.venue.basics.typePlaceholder")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {VENUE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(`venueTypes.${type}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormRootError />
        </WizardFrame>
      </form>
    </Form>
  );
}

function AddressStep({ frame, venue, save, onDone }: EditStepProps) {
  const t = useTranslations();
  const saved = venue?.address;
  const form = useForm<AddressValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      street: saved?.street ?? "",
      postalCode: saved?.postalCode ?? "",
      city: saved?.city ?? "",
    },
  });
  // A picked suggestion carries its point; typing in a field drops it, so the backend geocodes the text instead.
  const [point, setPoint] = useState<Point>();
  // Set once the backend could not place the address, so a second "Next" continues with it anyway.
  const [unlocated, setUnlocated] = useState(false);

  function edited() {
    setPoint(undefined);
    setUnlocated(false);
  }

  async function onSubmit(values: AddressValues) {
    if (unlocated) return onDone();
    try {
      const result = await save({
        address: {
          street: values.street,
          postalCode: values.postalCode || undefined,
          city: values.city,
          ...point,
        },
      });
      if (located(result.address)) onDone();
      else setUnlocated(true);
    } catch (failure) {
      showServerError(form, toApiProblem(failure), t);
    }
  }

  return (
    <Form {...form} translateError={translateFormError(t as Parameters<typeof translateFormError>[0])}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <WizardFrame
          {...frame}
          title={t("onboarding.venue.address.title")}
          intro={t("onboarding.venue.address.intro")}
          footer={<NextButton busy={form.formState.isSubmitting} />}
        >
          <VenueAddressFields
            form={form}
            names={{ street: "street", postalCode: "postalCode", city: "city" }}
            onEdit={edited}
            onPick={(picked) => {
              setPoint(picked);
              setUnlocated(false);
            }}
          />
          {unlocated ? (
            <div role="alert" className="flex items-start gap-2 text-sm text-danger">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>
                {t("onboarding.venue.address.notLocated")} {t("onboarding.venue.address.confirm")}
              </p>
            </div>
          ) : (
            (point || (located(saved) && !form.formState.isDirty)) && (
              <p role="status" className="flex items-center gap-2 text-sm">
                <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
                {t("onboarding.venue.address.located")}
              </p>
            )
          )}
          <FormRootError />
        </WizardFrame>
      </form>
    </Form>
  );
}

function MusicStep({ frame, venue, save, onDone }: EditStepProps) {
  const t = useTranslations();
  const [genres, setGenres] = useState<Genre[]>(venue?.genres ?? []);
  const [genreError, setGenreError] = useState<string>();
  const [photoError, setPhotoError] = useState<string>();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function run(work: () => Promise<unknown>) {
    setError(undefined);
    setSaving(true);
    try {
      await work();
      return true;
    } catch (failure) {
      setError(problemMessage(t, failure));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function onNext() {
    const noGenre = genres.length === 0;
    const noPhoto = !venue?.avatar;
    setGenreError(noGenre ? t("validation.genresRequired") : undefined);
    setPhotoError(noPhoto ? t("onboarding.photo.required") : undefined);
    if (noGenre || noPhoto) return;
    if (await run(() => save({ genres }))) onDone();
  }

  return (
    <WizardFrame {...frame} title={t("onboarding.venue.music.title")} busy={saving} onNext={onNext}>
      <ChoiceChips<Genre>
        legend={t("onboarding.venue.music.genres")}
        hint={t("onboarding.venue.music.genresHint")}
        options={GENRES.map((genre) => ({
          value: genre,
          label: t(`genres.${genre}`),
        }))}
        value={genres}
        onChange={(value) => {
          setGenreError(undefined);
          setGenres(value);
        }}
        max={MAX_GENRES}
        error={genreError}
      />
      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold uppercase">{t("onboarding.venue.music.photo")}</p>
        <PhotoField
          previewUrl={venue?.avatar?.medium}
          onUploaded={(image) => {
            setPhotoError(undefined);
            void run(() => save({ avatarMediaId: image.id }));
          }}
          error={photoError}
        />
      </div>
      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </WizardFrame>
  );
}

function VenueSummary({ frame, venue, exitTo }: StepProps & { exitTo: string }) {
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();
  const missing = venue?.missingForPublication ?? ["NAME", "TYPE", "ADDRESS", "GENRE", "AVATAR"];
  const owner = venue?.role === "OWNER";

  const publish = useMutation({
    mutationFn: async (venueId: string) =>
      unwrap(
        await api.POST("/api/v1/venues/{id}/publish", {
          params: { path: { id: venueId } },
        }),
      ),
    onSuccess: (saved) => {
      storeVenue(queryClient, saved);
      toast.success(t("onboarding.summary.published"));
      router.push(exitTo);
    },
  });

  return (
    <WizardFrame
      {...frame}
      title={t("onboarding.summary.title")}
      busy={publish.isPending}
      footer={
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={() => router.push(exitTo)}>
            {t("onboarding.summary.draft")}
          </Button>
          {owner && (
            <Button
              type="button"
              onClick={() => venue && publish.mutate(venue.id)}
              disabled={missing.length > 0 || publish.isPending}
            >
              {t("onboarding.summary.publish")}
            </Button>
          )}
        </div>
      }
    >
      {venue && (
        <div className="flex items-center gap-4">
          {venue.avatar && (
            // eslint-disable-next-line @next/next/no-img-element -- public WebP variant from the media module
            <img src={venue.avatar.small} alt="" className="size-20 border-2 border-border object-cover" />
          )}
          <div className="flex flex-col gap-1">
            <p className="font-display text-lg">{venue.name}</p>
            <p className="text-sm text-muted-foreground">
              {t(`venueTypes.${venue.type}`)}
              {venue.address && ` · ${venue.address.street}, ${venue.address.city}`}
            </p>
          </div>
        </div>
      )}
      <SummaryBody missing={missing} />
    </WizardFrame>
  );
}
