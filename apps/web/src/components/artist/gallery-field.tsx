"use client";

import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@spot-on-slot/ui";
import { PhotoField } from "@/components/onboarding/photo-field";
import { MAX_PHOTOS } from "./profile-form-values";

type Photo = { id: string; url: string };

/** The gallery: thumbnails with move and remove buttons (keyboard- and touch-friendly), plus an upload field. */
export function GalleryField({ value, onChange }: { value: Photo[]; onChange: (value: Photo[]) => void }) {
  const t = useTranslations("artistProfile.edit");

  function move(index: number, by: -1 | 1) {
    const next = [...value];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-bold uppercase">{t("gallery")}</p>
      <p className="-mt-2 text-xs text-muted-foreground">{t("galleryHint")}</p>
      {value.length > 0 && (
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {value.map((photo, index) => (
            <li key={photo.id} className="flex flex-col gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- public WebP variant from the media module */}
              <img src={photo.url} alt="" className="aspect-square w-full border-2 border-border object-cover" />
              <div className="flex justify-between gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label={t("moveLeft", { index: index + 1 })}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label={t("removePhoto", { index: index + 1 })}
                  onClick={() => onChange(value.filter((other) => other.id !== photo.id))}
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label={t("moveRight", { index: index + 1 })}
                  disabled={index === value.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
      {value.length < MAX_PHOTOS ? (
        <PhotoField
          chooseLabel={t("addPhoto")}
          onUploaded={(image) => onChange([...value, { id: image.id, url: image.variants.small }].slice(0, MAX_PHOTOS))}
        />
      ) : (
        <p className="text-sm">{t("galleryFull")}</p>
      )}
    </div>
  );
}
