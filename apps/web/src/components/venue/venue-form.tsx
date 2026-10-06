"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { toApiProblem, unwrap } from "@spot-on-slot/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CircleAlert, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  Button,
  ChoiceChips,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRootError,
  Input,
  PageHeader,
  Panel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TagInput,
  Textarea,
  toast,
  translateFormError,
} from "@spot-on-slot/ui";
import { GalleryField } from "@/components/artist/gallery-field";
import { AuthField } from "@/components/auth/auth-field";
import { showServerError } from "@/components/auth/server-error";
import { ApiErrorState } from "@/components/errors/api-error-state";
import { GENRES, MAX_GENRES, VENUE_TYPES } from "@/components/onboarding/options";
import { PhotoField } from "@/components/onboarding/photo-field";
import type { Genre, Venue } from "@/components/onboarding/profile-requests";
import { dropVenue, storeVenue, useMyVenues } from "@/components/onboarding/queries";
import { located, VenueAddressFields, type Point } from "@/components/onboarding/venue-address-fields";
import { api } from "@/lib/api";
import { problemMessage } from "@/lib/problem-text";
import { MAX_TAGS, toRequest, toValues, venueSchema, type VenueValues } from "./venue-form-values";
import { VENUE_LINKS } from "./venue-profile-view";

/** A venue of the signed-in account's teams, from the cached list; an unknown id explains itself. */
export function VenueLoader({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: (venue: Venue) => ReactNode;
}) {
  const t = useTranslations("venueProfile.mine");
  const venues = useMyVenues();
  const venue = venues.data?.find((item) => item.id === id);
  return (
    <section className="flex flex-col gap-4">
      <PageHeader
        title={title}
        back={
          <Button asChild variant="ghost" size="icon">
            <Link href={venue ? `/profile?venue=${venue.id}` : "/profile"} aria-label={t("back")}>
              <ArrowLeft className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        }
      />
      {venue && <p className="font-display text-lg leading-none">{venue.name}</p>}
      {venues.isError ? (
        <ApiErrorState error={venues.error} onRetry={() => venues.refetch()} />
      ) : venues.isPending ? (
        <Panel aria-busy="true" className="h-40" />
      ) : venue ? (
        children(venue)
      ) : (
        <Panel>
          <p className="text-sm">{t("notFound")}</p>
          <Button asChild className="self-start">
            <Link href="/profile">{t("back")}</Link>
          </Button>
        </Panel>
      )}
    </section>
  );
}

/** `/profile/venues/{id}/edit`: the whole venue in one form, saved at once. */
export function VenueEditor({ id }: { id: string }) {
  const t = useTranslations("venueProfile.edit");
  return (
    <VenueLoader id={id} title={t("title")}>
      {(venue) => <VenueForm key={venue.id} venue={venue} />}
    </VenueLoader>
  );
}

type SlugState = "idle" | "free" | "taken";

function VenueForm({ venue }: { venue: Venue }) {
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();
  const translate = translateFormError(t as Parameters<typeof translateFormError>[0]);
  const form = useForm<VenueValues>({ resolver: zodResolver(venueSchema), defaultValues: toValues(venue) });
  const [slugState, setSlugState] = useState<SlugState>("idle");
  // A picked suggestion carries its point; typing in an address field drops it.
  const [point, setPoint] = useState<Point>();
  const [addressEdited, setAddressEdited] = useState(false);
  const dirty = form.formState.isDirty;
  const description = useWatch({ control: form.control, name: "description" });
  const profilePath = `/profile?venue=${venue.id}`;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = useMutation({
    mutationFn: async (values: VenueValues) =>
      unwrap(
        await api.PUT("/api/v1/venues/{id}", {
          params: { path: { id: venue.id } },
          body: toRequest(values, venue, point),
        }),
      ),
    meta: { handlesErrors: true },
    onSuccess: (saved) => {
      storeVenue(queryClient, saved);
      form.reset(toValues(saved));
      if (saved.address && !located(saved.address)) toast.error(t("venueProfile.edit.savedUnlocated"));
      else toast.success(t("venueProfile.edit.saved"));
      router.push(profilePath);
    },
    onError: (failure) => showServerError(form, toApiProblem(failure), t),
  });

  async function checkSlug() {
    setSlugState("idle");
    const slug = form.getValues("slug").trim();
    if (slug === venue.slug || !(await form.trigger("slug"))) return;
    const result = await api.GET("/api/v1/venues/slugs/{slug}", {
      params: { path: { slug }, query: { venueId: venue.id } },
    });
    if (result.response.status === 204) setSlugState("free");
    else if (result.response.status === 409) {
      setSlugState("taken");
      form.setError("slug", { type: "server", message: t("artistProfile.edit.slugTaken") });
    }
  }

  function cancel() {
    if (!dirty || window.confirm(t("artistProfile.edit.leave"))) router.push(profilePath);
  }

  const showLocated = point != null || (!addressEdited && located(venue.address));
  return (
    <>
      <Form {...form} translateError={translate}>
        <form onSubmit={form.handleSubmit((values) => save.mutate(values))} className="flex flex-col gap-4" noValidate>
          <Panel title={t("venueProfile.edit.sections.basics")}>
            <AuthField control={form.control} name="name" label={t("venueProfile.edit.name")} />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("venueProfile.edit.type")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
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
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("venueProfile.edit.slug")}</FormLabel>
                  <div className="flex items-center gap-1 text-sm">
                    <span className="shrink-0 text-muted-foreground">/v/</span>
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(event) => {
                          setSlugState("idle");
                          field.onChange(event.target.value.toLowerCase());
                        }}
                        onBlur={() => {
                          field.onBlur();
                          void checkSlug();
                        }}
                        autoComplete="off"
                      />
                    </FormControl>
                  </div>
                  <FormDescription>{t("artistProfile.edit.slugHint")}</FormDescription>
                  {slugState === "free" && <p className="text-sm">{t("artistProfile.edit.slugFree")}</p>}
                  <FormMessage />
                </FormItem>
              )}
            />
            <AuthField
              control={form.control}
              name="capacity"
              label={t("venueProfile.edit.capacity")}
              inputMode="numeric"
            />
            <p className="-mt-2 text-xs text-muted-foreground">{t("venueProfile.edit.capacityHint")}</p>
          </Panel>

          <Panel title={t("venueProfile.edit.sections.address")}>
            <p className="text-xs text-muted-foreground">{t("venueProfile.edit.addressHint")}</p>
            <VenueAddressFields
              form={form}
              names={{ street: "street", postalCode: "postalCode", city: "city" }}
              onEdit={() => {
                setPoint(undefined);
                setAddressEdited(true);
              }}
              onPick={setPoint}
            />
            {showLocated ? (
              <p role="status" className="flex items-center gap-2 text-sm">
                <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
                {t("onboarding.venue.address.located")}
              </p>
            ) : (
              !addressEdited &&
              venue.address && (
                <p className="flex items-start gap-2 text-sm text-danger">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {t("onboarding.venue.address.notLocated")}
                </p>
              )
            )}
          </Panel>

          <Panel title={t("venueProfile.edit.sections.music")}>
            <FormField
              control={form.control}
              name="genres"
              render={({ field, fieldState }) => (
                <ChoiceChips<Genre>
                  legend={t("venueProfile.edit.genres")}
                  hint={t("artistProfile.edit.genresHint")}
                  options={GENRES.map((genre) => ({ value: genre, label: t(`genres.${genre}`) }))}
                  value={field.value}
                  onChange={field.onChange}
                  max={MAX_GENRES}
                  error={fieldState.error?.message ? translate(fieldState.error.message) : undefined}
                />
              )}
            />
            <FormField
              control={form.control}
              name="tags"
              render={({ field, fieldState }) => (
                <TagInput
                  labels={{
                    label: t("artistProfile.edit.tags"),
                    hint: t("venueProfile.edit.tagsHint"),
                    placeholder: t("artistProfile.edit.tagsPlaceholder"),
                    remove: (tag) => t("artistProfile.edit.removeTag", { tag }),
                  }}
                  value={field.value}
                  onChange={field.onChange}
                  max={MAX_TAGS}
                  maxLength={30}
                  error={fieldState.error?.message ? translate(fieldState.error.message) : undefined}
                />
              )}
            />
          </Panel>

          <Panel title={t("venueProfile.edit.sections.description")}>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("venueProfile.edit.description")}</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={6} maxLength={2000} />
                  </FormControl>
                  <FormDescription>{t("artistProfile.edit.bioCount", { count: description.length })}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Panel>

          <Panel title={t("venueProfile.edit.sections.photos")}>
            <FormField
              control={form.control}
              name="avatar"
              render={({ field }) => (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-bold uppercase">{t("artistProfile.edit.avatar")}</p>
                  <PhotoField
                    previewUrl={field.value?.url}
                    onUploaded={(image) => field.onChange({ id: image.id, url: image.variants.medium })}
                  />
                </div>
              )}
            />
            <FormField
              control={form.control}
              name="photos"
              render={({ field }) => <GalleryField value={field.value} onChange={field.onChange} />}
            />
          </Panel>

          <Panel title={t("venueProfile.edit.sections.links")}>
            <p className="text-xs text-muted-foreground">{t("venueProfile.edit.linksHint")}</p>
            <div className="grid gap-4 sm:grid-cols-3">
              {VENUE_LINKS.map((key) => (
                <AuthField
                  key={key}
                  control={form.control}
                  name={`links.${key}`}
                  label={t(`venueProfile.view.linkNames.${key}`)}
                  type="url"
                  inputMode="url"
                />
              ))}
            </div>
          </Panel>

          <FormRootError />
          <div className="sticky bottom-20 z-10 flex justify-end gap-3 border-2 border-border bg-card p-3 md:bottom-4">
            <Button type="button" variant="outline" onClick={cancel}>
              {t("artistProfile.edit.cancel")}
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? t("artistProfile.edit.saving") : t("artistProfile.edit.save")}
            </Button>
          </div>
        </form>
      </Form>
      {venue.role === "OWNER" && <DeleteVenue venue={venue} />}
    </>
  );
}

/** Deleting cannot be undone, so the owner types the venue name first. */
function DeleteVenue({ venue }: { venue: Venue }) {
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();
  const inputId = useId();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string>();

  const remove = useMutation({
    mutationFn: async () => unwrap(await api.DELETE("/api/v1/venues/{id}", { params: { path: { id: venue.id } } })),
    meta: { handlesErrors: true },
    onSuccess: () => {
      dropVenue(queryClient, venue.id);
      toast.success(t("venueProfile.edit.deleted"));
      router.push("/profile");
    },
    onError: (failure) => setError(problemMessage(t, failure)),
  });

  return (
    <Panel title={t("venueProfile.edit.sections.danger")} className="border-danger">
      <p className="text-sm">{t("venueProfile.edit.deleteText")}</p>
      <div className="flex flex-col gap-2">
        <label htmlFor={inputId} className="text-sm font-bold">
          {t("venueProfile.edit.deleteConfirm", { name: venue.name })}
        </label>
        <Input id={inputId} value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" />
      </div>
      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      <Button
        type="button"
        variant="destructive"
        className="self-start"
        disabled={typed.trim() !== venue.name.trim() || remove.isPending}
        onClick={() => remove.mutate()}
      >
        {remove.isPending ? t("venueProfile.edit.deleting") : t("venueProfile.edit.delete")}
      </Button>
    </Panel>
  );
}
