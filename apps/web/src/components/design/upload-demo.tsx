"use client";

import { toApiProblem, unwrap, uploadImage, type MediaImage } from "@spot-on-slot/api-client";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button, ImagePicker, Panel, toast } from "@spot-on-slot/ui";
import { api } from "@/lib/api";
import { fallbackMessage } from "@/lib/problem-text";

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];
const VARIANTS = ["small", "medium", "large"] as const;

/** Longer side 320 / 800 / 1600 px, never upscaled: the size a variant ends up with. */
function variantSize(image: MediaImage, longest: number) {
  const factor = Math.min(1, longest / Math.max(image.width, image.height));
  return { width: Math.round(image.width * factor), height: Math.round(image.height * factor) };
}
const LONGEST = { small: 320, medium: 800, large: 1600 } as const;

/** Preview of the B2 upload flow against the real backend; the profile screens (W2–W4) will reuse the pieces. */
export function UploadDemo() {
  const t = useTranslations();
  const [image, setImage] = useState<MediaImage | null>(null);
  const [error, setError] = useState<string>();

  const upload = useMutation({
    mutationFn: (file: File) => uploadImage(api, file),
    meta: { handlesErrors: true },
    onSuccess: (uploaded) => setImage(uploaded),
    onError: (failure) => {
      const problem = toApiProblem(failure);
      setError(problem.detail || problem.title || fallbackMessage(t, problem));
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      unwrap(await api.DELETE("/api/v1/media/{id}", { params: { path: { id } } }));
    },
    onSuccess: () => {
      setImage(null);
      toast.success(t("design.upload.deleted"));
    },
  });

  function onSelect(file: File) {
    setError(undefined);
    if (!TYPES.includes(file.type)) return setError(t("design.upload.unsupported"));
    if (file.size > MAX_BYTES) return setError(t("design.upload.tooLarge"));
    upload.mutate(file);
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 md:items-start">
      <ImagePicker
        labels={{
          choose: t("design.upload.choose"),
          drop: t("design.upload.drop"),
          hint: t("design.upload.hint"),
          uploading: t("design.upload.uploading"),
          previewAlt: t("design.upload.previewAlt"),
        }}
        onSelect={onSelect}
        previewUrl={image?.variants.medium}
        uploading={upload.isPending}
        error={error}
      />
      {image && (
        <Panel title={t("design.upload.variants")}>
          <ul className="flex flex-col gap-3">
            {VARIANTS.map((name) => (
              <li key={name} className="flex items-center justify-between gap-3 border-b-2 border-border pb-3 text-sm">
                <span>
                  {t("design.upload.variant", { name: t(`design.upload.names.${name}`), ...variantSize(image, LONGEST[name]) })}
                </span>
                <a href={image.variants[name]} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-primary">
                  {t("design.upload.open")}
                </a>
              </li>
            ))}
          </ul>
          <Button variant="outline" onClick={() => remove.mutate(image.id)} disabled={remove.isPending} className="self-start">
            {t("design.upload.delete")}
          </Button>
        </Panel>
      )}
    </div>
  );
}
