"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { toApiProblem, unwrap } from "@spot-on-slot/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  Button,
  ChoiceChips,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRootError,
  Input,
  Textarea,
  toast,
  translateFormError,
} from "@spot-on-slot/ui";
import { AuthField } from "@/components/auth/auth-field";
import { showServerError } from "@/components/auth/server-error";
import { useCalendar, type Occurrence } from "@/components/calendar/queries";
import { today } from "@/components/calendar/warsaw-time";
import { GENRES, MAX_GENRES } from "@/components/onboarding/options";
import type { Genre } from "@/components/onboarding/profile-requests";
import { api } from "@/lib/api";
import {
  artistSchema,
  blankValues,
  endsNextDay,
  MAX_ARTIST_DESCRIPTION,
  MAX_VENUE_DESCRIPTION,
  toRequest,
  toValues,
  venueSchema,
  type ListingValues,
} from "./listing-form-values";
import { useTermText } from "./listing-time";
import { announcing, LISTINGS, useArtistListings, type Listing } from "./queries";

/** How far ahead the artist picks free time from (the calendar reads at most 92 days). */
export const PICK_DAYS = 90;

/** A new listing (artists may come with a free time already picked), an edit, or a copy of an ended one. */
export type ListingDialogTarget =
  | { mode: "new"; term?: Pick<Occurrence, "startsAt" | "endsAt"> }
  | { mode: "edit"; listing: Listing }
  | { mode: "copy"; listing: Listing };

/** Where the listing goes and what a blank one starts with (from the profile). */
export type ListingAuthor =
  | {
      kind: "ARTIST_AVAILABLE";
      genres: Genre[];
      priceFrom?: number | null;
      priceTo?: number | null;
      travelRadiusKm?: number | null;
    }
  | { kind: "VENUE_SEEKING"; venueId: string; genres: Genre[] };

export function ListingDialog({
  target,
  author,
  onClose,
}: {
  target: ListingDialogTarget | null;
  author: ListingAuthor;
  onClose: () => void;
}) {
  const t = useTranslations();
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      {target && (
        <DialogContent
          closeLabel={t("common.close")}
          className="max-h-[90vh] overflow-y-auto rounded-none border-2 border-border"
        >
          <ListingFlow key={JSON.stringify(target)} target={target} author={author} onDone={onClose} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function initialValues(target: ListingDialogTarget, author: ListingAuthor): ListingValues {
  if (target.mode !== "new") return toValues(target.listing, target.mode === "copy");
  const blank = blankValues({ ...author, day: today() });
  return target.term ? { ...blank, startsAt: target.term.startsAt, endsAt: target.term.endsAt } : blank;
}

function ListingFlow({
  target,
  author,
  onDone,
}: {
  target: ListingDialogTarget;
  author: ListingAuthor;
  onDone: () => void;
}) {
  const t = useTranslations("listings.dialog");
  const artist = author.kind === "ARTIST_AVAILABLE";
  const values = initialValues(target, author);
  const [term, setTerm] = useState(values.startsAt ? { startsAt: values.startsAt, endsAt: values.endsAt } : null);
  const picking = artist && term === null;
  const title = target.mode === "edit" ? t("editTitle") : artist ? t("artistTitle") : t("venueTitle");

  return (
    <>
      <DialogHeader>
        <DialogTitle className="uppercase">{title}</DialogTitle>
        <DialogDescription>{picking ? t("pickHint") : artist ? t("artistHint") : t("venueHint")}</DialogDescription>
      </DialogHeader>
      {picking ? (
        <TermPicker current={target.mode === "edit" ? target.listing.id : undefined} onPick={setTerm} />
      ) : (
        <ListingForm
          target={target}
          author={author}
          values={term ? { ...values, ...term } : values}
          onChangeTerm={artist ? () => setTerm(null) : undefined}
          onDone={onDone}
        />
      )}
    </>
  );
}

/** Step 1 for artists: free, not yet started time from the calendar; announced time cannot be picked again. */
function TermPicker({
  current,
  onPick,
}: {
  current?: string;
  onPick: (term: { startsAt: string; endsAt: string }) => void;
}) {
  const t = useTranslations("listings.dialog");
  const termText = useTermText();
  const [range] = useState(() => {
    const now = new Date();
    return { from: now, to: new Date(now.getTime() + PICK_DAYS * 86_400_000) };
  });
  const calendar = useCalendar(range.from, range.to);
  const active = useArtistListings("active");
  const free = useMemo(
    () => (calendar.data ?? []).filter((entry) => entry.status === "FREE" && new Date(entry.startsAt) > range.from),
    [calendar.data, range.from],
  );

  if (calendar.isPending || active.isPending) return <p className="text-sm text-muted-foreground">{t("loading")}</p>;
  if (free.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm">{t("noFree")}</p>
        <Button asChild>
          <Link href="/calendar">{t("goCalendar")}</Link>
        </Button>
      </div>
    );
  }
  return (
    <ul aria-label={t("pickTitle")} className="flex flex-col gap-2">
      {free.map((entry) => {
        const taken = announcing(
          active.data?.filter((listing) => listing.id !== current),
          entry,
        );
        const text = termText(entry.startsAt, entry.endsAt);
        return (
          <li key={`${entry.startsAt}-${entry.slotId ?? entry.ruleId}`}>
            <button
              type="button"
              disabled={taken != null}
              onClick={() => onPick({ startsAt: entry.startsAt, endsAt: entry.endsAt })}
              className="flex w-full flex-wrap items-center justify-between gap-2 border-2 border-border bg-highlight px-3 py-2 text-left text-sm font-bold tabular-nums text-highlight-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:border-dashed disabled:bg-transparent disabled:text-muted-foreground"
            >
              <span>{text}</span>
              {taken && <span className="text-[0.625rem] uppercase">{t("announced")}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ListingForm({
  target,
  author,
  values,
  onChangeTerm,
  onDone,
}: {
  target: ListingDialogTarget;
  author: ListingAuthor;
  values: ListingValues;
  onChangeTerm?: () => void;
  onDone: () => void;
}) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const termText = useTermText();
  const artist = author.kind === "ARTIST_AVAILABLE";
  const form = useForm<ListingValues>({
    resolver: zodResolver(artist ? artistSchema : venueSchema),
    defaultValues: values,
  });
  const [description, from, to] = useWatch({ control: form.control, name: ["description", "from", "to"] });
  const translate = (key: string) => t(key as Parameters<typeof t>[0]);
  const maxDescription = artist ? MAX_ARTIST_DESCRIPTION : MAX_VENUE_DESCRIPTION;

  async function onSubmit(submitted: ListingValues) {
    const body = toRequest(submitted, author.kind);
    try {
      if (target.mode === "edit") {
        unwrap(await api.PUT("/api/v1/listings/{id}", { params: { path: { id: target.listing.id } }, body }));
      } else if (author.kind === "ARTIST_AVAILABLE") {
        unwrap(await api.POST("/api/v1/listings/mine", { body }));
      } else {
        unwrap(
          await api.POST("/api/v1/venues/{venueId}/listings", { params: { path: { venueId: author.venueId } }, body }),
        );
      }
      await queryClient.invalidateQueries({ queryKey: LISTINGS });
      toast.success(t(target.mode === "edit" ? "listings.dialog.updated" : "listings.dialog.published"));
      onDone();
    } catch (failure) {
      showServerError(form, toApiProblem(failure), t);
    }
  }

  return (
    <Form {...form} translateError={translateFormError(t as Parameters<typeof translateFormError>[0])}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        {artist ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-2 border-border bg-highlight px-3 py-2 text-highlight-foreground">
            <p className="text-sm font-bold tabular-nums">
              <span className="sr-only">{t("listings.dialog.term")}: </span>
              {termText(values.startsAt, values.endsAt)}
            </p>
            {onChangeTerm && (
              <Button type="button" size="sm" variant="outline" onClick={onChangeTerm}>
                {t("listings.dialog.changeTerm")}
              </Button>
            )}
          </div>
        ) : (
          <>
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("listings.dialog.date")}</FormLabel>
                  <FormControl>
                    <Input type="date" min={today()} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              {(["from", "to"] as const).map((name) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t(`listings.dialog.${name}`)}</FormLabel>
                      <FormControl>
                        <Input type="time" step={300} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
            {endsNextDay(from, to) && (
              <p className="-mt-2 text-xs text-muted-foreground" aria-live="polite">
                {t("listings.dialog.nextDay")}
              </p>
            )}
          </>
        )}
        <FormField
          control={form.control}
          name="genres"
          render={({ field, fieldState }) => (
            <ChoiceChips<Genre>
              legend={t("listings.dialog.genres")}
              hint={t("listings.dialog.genresHint")}
              options={GENRES.map((genre) => ({ value: genre, label: t(`genres.${genre}`) }))}
              value={field.value}
              onChange={field.onChange}
              max={MAX_GENRES}
              error={fieldState.error?.message ? translate(fieldState.error.message) : undefined}
            />
          )}
        />
        <div className={"grid gap-4 " + (artist ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
          <AuthField
            control={form.control}
            name="priceFrom"
            label={artist ? t("listings.dialog.rateFrom") : t("listings.dialog.budgetFrom")}
            inputMode="numeric"
          />
          <AuthField
            control={form.control}
            name="priceTo"
            label={artist ? t("listings.dialog.rateTo") : t("listings.dialog.budgetTo")}
            inputMode="numeric"
          />
          {artist && (
            <AuthField
              control={form.control}
              name="travelRadiusKm"
              label={t("listings.dialog.radius")}
              inputMode="numeric"
            />
          )}
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">{t("listings.dialog.priceHint")}</p>
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("listings.dialog.description")}</FormLabel>
              <FormControl>
                <Textarea
                  rows={4}
                  maxLength={maxDescription}
                  placeholder={artist ? t("listings.dialog.artistPlaceholder") : t("listings.dialog.venuePlaceholder")}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                {t("listings.dialog.count", { count: description.length, max: maxDescription })}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormRootError />
        <Button type="submit" className="self-start" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting
            ? t("listings.dialog.saving")
            : target.mode === "edit"
              ? t("listings.dialog.save")
              : t("listings.dialog.publish")}
        </Button>
      </form>
    </Form>
  );
}
