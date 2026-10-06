import type { ApiSchemas } from "@spot-on-slot/api-client";
import { useFormatter, useTranslations } from "next-intl";
import { Panel, PixelHeadphones, PixelPin, SkillMeter, Tag } from "@spot-on-slot/ui";

type PublicProfile = ApiSchemas["PublicProfileResponse"];

/** What the profile shows: the public fields, which the artist's own profile has too. */
export type ArtistViewData = Pick<
  PublicProfile,
  | "stageName"
  | "bio"
  | "genres"
  | "tags"
  | "links"
  | "rate"
  | "travelRadiusKm"
  | "skills"
  | "avatar"
  | "photos"
  | "location"
>;

export const SKILLS = ["tempo", "experience", "energy", "vinyl", "cdj", "production"] as const;
export const LINKS = ["soundcloud", "spotify", "instagram", "youtube"] as const;

/**
 * The artist profile in the "DJ profile" mockup layout. It uses no client hooks, so the public page renders it on
 * the server and the artist's own preview in the app.
 */
export function ArtistProfileView({ profile, headingLevel = 2 }: { profile: ArtistViewData; headingLevel?: 1 | 2 }) {
  const t = useTranslations();
  const format = useFormatter();
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const skills = SKILLS.filter((key) => profile.skills[key] != null);
  const links = LINKS.filter((key) => profile.links[key]);
  const zl = (grosze: number) => format.number(grosze / 100, { maximumFractionDigits: 0 });

  const rate = profile.rate;
  const rateText =
    rate?.from != null && rate.to != null
      ? t("artistProfile.view.rateRange", { from: zl(rate.from), to: zl(rate.to) })
      : rate?.from != null
        ? t("artistProfile.view.rateFrom", { from: zl(rate.from) })
        : rate?.to != null
          ? t("artistProfile.view.rateTo", { to: zl(rate.to) })
          : t("artistProfile.view.rateOpen");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:items-start">
        <Panel className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start md:grid-cols-1">
          {profile.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- public WebP variant from the media module
            <img
              src={profile.avatar.medium}
              alt={t("artistProfile.view.avatarAlt", { name: profile.stageName })}
              width={profile.avatar.width}
              height={profile.avatar.height}
              className="aspect-square w-full border-2 border-border object-cover"
            />
          ) : (
            <div className="flex aspect-square items-center justify-center border-2 border-border bg-heading dark:bg-background">
              <PixelHeadphones className="w-3/5 text-highlight" />
            </div>
          )}
          <div className="flex min-w-0 flex-col gap-4">
            <Heading className="font-display text-xl leading-none break-words sm:text-3xl md:text-4xl">
              {profile.stageName}
            </Heading>
            {profile.location && (
              <p className="flex items-start gap-2 text-xs uppercase">
                <PixelPin className="mt-px size-3.5 shrink-0 text-primary dark:text-highlight" />
                <span className="flex flex-col gap-1">
                  <span>{profile.location.city}</span>
                  <span>{t("artistProfile.view.radius", { km: profile.travelRadiusKm })}</span>
                </span>
              </p>
            )}
            {(profile.genres.length > 0 || profile.tags.length > 0) && (
              <ul className="flex flex-wrap gap-2">
                {profile.genres.map((genre) => (
                  <li key={genre}>
                    <Tag>{t(`genres.${genre}`)}</Tag>
                  </li>
                ))}
                {profile.tags.map((tag) => (
                  <li key={`tag-${tag}`}>
                    <Tag className="bg-transparent">#{tag}</Tag>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
        <div className="flex flex-col gap-4">
          {skills.length > 0 && (
            <Panel title={t("artistProfile.view.skills")} headingLevel={3}>
              <div className="flex flex-col gap-3">
                {skills.map((key) => (
                  <SkillMeter key={key} label={t(`artistProfile.skill.${key}`)} value={profile.skills[key] ?? 0} />
                ))}
              </div>
            </Panel>
          )}
          <Panel title={t("artistProfile.view.about")} headingLevel={3}>
            <p className="whitespace-pre-line text-sm leading-relaxed">
              {profile.bio || <span className="text-muted-foreground">{t("artistProfile.view.noBio")}</span>}
            </p>
          </Panel>
          {links.length > 0 && (
            <Panel title={t("artistProfile.view.links")} headingLevel={3}>
              <ul className="flex flex-wrap gap-2">
                {links.map((key) => (
                  <li key={key}>
                    <a
                      href={profile.links[key]}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex border-2 border-border px-3 py-1.5 text-xs font-bold uppercase hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {t(`artistProfile.view.linkNames.${key}`)} ↗
                    </a>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel title={t("artistProfile.view.rate")} headingLevel={3}>
            <p className="font-display text-lg">{rateText}</p>
          </Panel>
        </div>
      </div>
      {profile.photos.length > 0 && (
        <Panel title={t("artistProfile.view.gallery")} headingLevel={3}>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {profile.photos.map((photo, index) => (
              <li key={photo.id}>
                <a
                  href={photo.large}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- public WebP variant from the media module */}
                  <img
                    src={photo.small}
                    alt={t("artistProfile.view.photoAlt", { index: index + 1, total: profile.photos.length })}
                    loading="lazy"
                    className="aspect-square w-full border-2 border-border object-cover"
                  />
                </a>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
