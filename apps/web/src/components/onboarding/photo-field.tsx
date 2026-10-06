"use client";

import { toApiProblem, uploadImage, type MediaImage } from "@spot-on-slot/api-client";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ImagePicker } from "@spot-on-slot/ui";
import { api } from "@/lib/api";
import { fallbackMessage } from "@/lib/problem-text";

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Uploads a photo through the media module and hands the stored image to the caller, which saves the profile. */
export function PhotoField({
  previewUrl,
  onUploaded,
  error,
}: {
  previewUrl?: string;
  onUploaded: (image: MediaImage) => void;
  error?: string;
}) {
  const t = useTranslations();
  const [problem, setProblem] = useState<string>();

  const upload = useMutation({
    mutationFn: (file: File) => uploadImage(api, file),
    meta: { handlesErrors: true },
    onSuccess: onUploaded,
    onError: (failure) => {
      const found = toApiProblem(failure);
      setProblem(found.detail || found.title || fallbackMessage(t, found));
    },
  });

  function onSelect(file: File) {
    setProblem(undefined);
    if (!TYPES.includes(file.type)) return setProblem(t("onboarding.photo.unsupported"));
    if (file.size > MAX_BYTES) return setProblem(t("onboarding.photo.tooLarge"));
    upload.mutate(file);
  }

  return (
    <ImagePicker
      labels={{
        choose: t("onboarding.photo.choose"),
        drop: t("onboarding.photo.drop"),
        hint: t("onboarding.photo.hint"),
        uploading: t("onboarding.photo.uploading"),
        previewAlt: t("onboarding.photo.previewAlt"),
      }}
      onSelect={onSelect}
      previewUrl={previewUrl}
      uploading={upload.isPending}
      error={problem ?? error}
    />
  );
}
