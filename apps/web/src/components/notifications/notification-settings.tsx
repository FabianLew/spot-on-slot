"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import {
  Button,
  Checkbox,
  ChoiceChips,
  Label,
  Panel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@spot-on-slot/ui";
import { GENRES } from "@/components/onboarding/options";
import type { Genre } from "@/components/onboarding/profile-requests";
import { ApiErrorState } from "@/components/errors/api-error-state";
import {
  useNotificationPreferences,
  useSaveNotificationPreferences,
  type NearbyListingsRequest,
  type NotificationPreferences,
} from "./queries";

/** Radius choices besides the default (travel radius for artists, 50 km for venues); the backend takes 5–200 km. */
export const RADIUS_OPTIONS = [10, 25, 50, 100, 150, 200] as const;
const DEFAULT = "default";

const toValues = (
  preferences: NotificationPreferences,
): NearbyListingsRequest => ({
  enabled: preferences.nearbyListings.enabled,
  email: preferences.nearbyListings.email,
  radiusKm: preferences.nearbyListings.radiusKm ?? undefined,
  genres: preferences.nearbyListings.genres,
});

/** "Ustawienia → Powiadomienia": alerts about listings nearby, their e-mail, radius and genres. */
export function NotificationSettings() {
  const preferences = useNotificationPreferences();
  if (preferences.isError)
    return (
      <ApiErrorState
        error={preferences.error}
        onRetry={() => preferences.refetch()}
      />
    );
  if (preferences.isPending) return <Panel aria-busy="true" className="h-40" />;
  return <SettingsForm preferences={preferences.data} />;
}

function SettingsForm({
  preferences,
}: {
  preferences: NotificationPreferences;
}) {
  const t = useTranslations("notifications.settings");
  const tGenres = useTranslations("genres");
  const save = useSaveNotificationPreferences();
  const [values, setValues] = useState<NearbyListingsRequest>(() =>
    toValues(preferences),
  );

  const defaults = preferences.nearbyListings;
  const update = (patch: Partial<NearbyListingsRequest>) =>
    setValues({ ...values, ...patch });
  const radiusOptions = [
    ...new Set<number>([
      ...RADIUS_OPTIONS,
      ...(values.radiusKm != null ? [values.radiusKm] : []),
    ]),
  ].sort((a, b) => a - b);

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate(values, { onSuccess: () => toast.success(t("saved")) });
  }

  return (
    <Panel id="notifications">
      <form
        onSubmit={submit}
        className="flex flex-col gap-5"
        aria-labelledby="notification-settings-title"
      >
        <div className="flex flex-col gap-1">
          <h2 id="notification-settings-title" className="font-display text-lg">
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex items-center gap-3">
          <Checkbox
            id="nearby-enabled"
            checked={values.enabled}
            onCheckedChange={(checked) => update({ enabled: checked === true })}
          />
          <Label htmlFor="nearby-enabled">{t("enabled")}</Label>
        </div>
        <div className="flex items-center gap-3">
          <Checkbox
            id="nearby-email"
            checked={values.enabled && values.email}
            disabled={!values.enabled}
            onCheckedChange={(checked) => update({ email: checked === true })}
          />
          <Label htmlFor="nearby-email">{t("email")}</Label>
        </div>
        <div className="flex max-w-xs flex-col gap-2">
          <Label htmlFor="nearby-radius">{t("radius")}</Label>
          <Select
            value={values.radiusKm == null ? DEFAULT : String(values.radiusKm)}
            onValueChange={(value) =>
              update({
                radiusKm: value === DEFAULT ? undefined : Number(value),
              })
            }
            disabled={!values.enabled}
          >
            <SelectTrigger id="nearby-radius">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT}>
                {t("radiusDefault", { km: defaults.defaultRadiusKm })}
              </SelectItem>
              {radiusOptions.map((km) => (
                <SelectItem key={km} value={String(km)}>
                  {t("radiusKm", { km })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ChoiceChips<Genre>
          legend={t("genres")}
          hint={
            defaults.defaultGenres.length > 0
              ? t("genresHint", {
                  genres: defaults.defaultGenres
                    .map((genre) => tGenres(genre))
                    .join(", "),
                })
              : t("genresHintNone")
          }
          options={GENRES.map((genre) => ({
            value: genre,
            label: tGenres(genre),
          }))}
          value={values.genres ?? []}
          onChange={(genres) => update({ genres })}
        />
        <p className="text-xs text-muted-foreground">{t("push")}</p>
        <Button type="submit" className="self-start" disabled={save.isPending}>
          {t("save")}
        </Button>
      </form>
    </Panel>
  );
}
