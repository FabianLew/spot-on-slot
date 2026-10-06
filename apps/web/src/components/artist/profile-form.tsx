"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { toApiProblem, unwrap } from "@spot-on-slot/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  PageHeader,
  Panel,
  SkillSlider,
  TagInput,
  Textarea,
  toast,
  translateFormError,
} from "@spot-on-slot/ui";
import { AuthField } from "@/components/auth/auth-field";
import { showServerError } from "@/components/auth/server-error";
import { ApiErrorState } from "@/components/errors/api-error-state";
import { ArtistLocationPicker } from "@/components/onboarding/artist-location-picker";
import { GENRES, MAX_GENRES } from "@/components/onboarding/options";
import { PhotoField } from "@/components/onboarding/photo-field";
import type { ArtistProfile, Genre } from "@/components/onboarding/profile-requests";
import { ARTIST_PROFILE, useArtistProfile } from "@/components/onboarding/queries";
import { api } from "@/lib/api";
import { LINKS, SKILLS } from "./artist-profile-view";
import { GalleryField } from "./gallery-field";
import { MAX_TAGS, profileSchema, toRequest, toValues, type ProfileValues } from "./profile-form-values";

/** `/profile/edit`: the whole artist profile in one form, saved at once. */
export function ProfileEditor() {
  const t = useTranslations("artistProfile");
  const router = useRouter();
  const profile = useArtistProfile();

  // Editing needs a profile; the wizard creates it.
  useEffect(() => {
    if (profile.isSuccess && profile.data === null) router.replace("/onboarding");
  }, [profile.isSuccess, profile.data, router]);

  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={t("edit.title")} />
      {profile.isError ? (
        <ApiErrorState error={profile.error} onRetry={() => profile.refetch()} />
      ) : profile.data ? (
        <ProfileForm profile={profile.data} />
      ) : (
        <Panel aria-busy="true" className="h-40" />
      )}
    </section>
  );
}

type SlugState = "idle" | "free" | "taken";

function ProfileForm({ profile }: { profile: ArtistProfile }) {
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();
  const translate = translateFormError(t as Parameters<typeof translateFormError>[0]);
  const form = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: toValues(profile) });
  const [slugState, setSlugState] = useState<SlugState>("idle");
  const dirty = form.formState.isDirty;
  const bio = useWatch({ control: form.control, name: "bio" });

  // The browser asks before closing or reloading a page with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = useMutation({
    mutationFn: async (values: ProfileValues) =>
      unwrap(await api.PUT("/api/v1/artists/me", { body: toRequest(values, profile) })),
    meta: { handlesErrors: true },
    onSuccess: (saved) => {
      queryClient.setQueryData(ARTIST_PROFILE, saved);
      form.reset(toValues(saved));
      toast.success(t("artistProfile.edit.saved"));
      router.push("/profile");
    },
    onError: (failure) => showServerError(form, toApiProblem(failure), t),
  });

  async function checkSlug() {
    setSlugState("idle");
    const slug = form.getValues("slug").trim();
    if (slug === profile.slug || !(await form.trigger("slug"))) return;
    const result = await api.GET("/api/v1/artists/slugs/{slug}", { params: { path: { slug } } });
    if (result.response.status === 204) setSlugState("free");
    else if (result.response.status === 409) {
      setSlugState("taken");
      form.setError("slug", { type: "server", message: t("artistProfile.edit.slugTaken") });
    }
  }

  function cancel() {
    if (!dirty || window.confirm(t("artistProfile.edit.leave"))) router.push("/profile");
  }

  return (
    <Form {...form} translateError={translate}>
      <form onSubmit={form.handleSubmit((values) => save.mutate(values))} className="flex flex-col gap-4" noValidate>
        <Panel title={t("artistProfile.edit.sections.basics")}>
          <AuthField control={form.control} name="stageName" label={t("artistProfile.edit.stageName")} />
          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("artistProfile.edit.slug")}</FormLabel>
                <div className="flex items-center gap-1 text-sm">
                  <span className="shrink-0 text-muted-foreground">/a/</span>
                  <FormControl>
                    <input
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
                      className="flex h-10 w-full rounded-md border border-input bg-field px-3 py-2 text-sm text-foreground aria-invalid:border-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    />
                  </FormControl>
                </div>
                <FormDescription>{t("artistProfile.edit.slugHint")}</FormDescription>
                {slugState === "free" && <p className="text-sm">{t("artistProfile.edit.slugFree")}</p>}
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <AuthField
              control={form.control}
              name="firstName"
              label={t("artistProfile.edit.firstName")}
              autoComplete="given-name"
            />
            <AuthField
              control={form.control}
              name="lastName"
              label={t("artistProfile.edit.lastName")}
              autoComplete="family-name"
            />
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">{t("artistProfile.edit.privateHint")}</p>
        </Panel>

        <Panel title={t("artistProfile.edit.sections.music")}>
          <FormField
            control={form.control}
            name="genres"
            render={({ field, fieldState }) => (
              <ChoiceChips<Genre>
                legend={t("artistProfile.edit.genres")}
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
                  hint: t("artistProfile.edit.tagsHint"),
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

        <Panel title={t("artistProfile.edit.sections.about")}>
          <FormField
            control={form.control}
            name="bio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("artistProfile.edit.bio")}</FormLabel>
                <FormControl>
                  <Textarea {...field} rows={6} maxLength={2000} />
                </FormControl>
                <FormDescription>{t("artistProfile.edit.bioCount", { count: bio.length })}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </Panel>

        <Panel title={t("artistProfile.edit.sections.photos")}>
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

        <Panel title={t("artistProfile.edit.sections.links")}>
          <p className="text-xs text-muted-foreground">{t("artistProfile.edit.linksHint")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {LINKS.map((key) => (
              <AuthField
                key={key}
                control={form.control}
                name={`links.${key}`}
                label={t(`artistProfile.view.linkNames.${key}`)}
                type="url"
                inputMode="url"
              />
            ))}
          </div>
        </Panel>

        <Panel title={t("artistProfile.edit.sections.rate")}>
          <div className="grid gap-4 sm:grid-cols-3">
            <AuthField
              control={form.control}
              name="rateFrom"
              label={t("artistProfile.edit.rateFrom")}
              inputMode="numeric"
            />
            <AuthField
              control={form.control}
              name="rateTo"
              label={t("artistProfile.edit.rateTo")}
              inputMode="numeric"
            />
            <AuthField
              control={form.control}
              name="travelRadiusKm"
              label={t("artistProfile.edit.travel")}
              inputMode="numeric"
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("artistProfile.edit.rateHint")}</p>
        </Panel>

        <Panel title={t("artistProfile.edit.sections.skills")}>
          <p className="text-xs text-muted-foreground">{t("artistProfile.edit.skillsHint")}</p>
          <div className="grid gap-5 sm:grid-cols-2">
            {SKILLS.map((key) => (
              <FormField
                key={key}
                control={form.control}
                name={`skills.${key}`}
                render={({ field }) => (
                  <SkillSlider
                    label={t(`artistProfile.skill.${key}`)}
                    value={field.value}
                    onChange={field.onChange}
                    unsetLabel={t("artistProfile.edit.unset")}
                  />
                )}
              />
            ))}
          </div>
        </Panel>

        <Panel title={t("artistProfile.edit.sections.location")}>
          <p role="status" className="text-sm">
            {profile.location
              ? t("artistProfile.edit.locationCurrent", { label: profile.location.label })
              : t("artistProfile.edit.locationNone")}
          </p>
          <ArtistLocationPicker />
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
  );
}
