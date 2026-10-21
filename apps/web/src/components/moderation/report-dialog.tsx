"use client";

import { toApiProblem, unwrap, type ApiSchemas } from "@spot-on-slot/api-client";
import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
  cn,
} from "@spot-on-slot/ui";
import { api } from "@/lib/api";
import { problemMessage } from "@/lib/problem-text";

type ReportRequest = ApiSchemas["ReportRequest"];
export type ReportReason = ReportRequest["reason"];

/** What is reported: profiles and venues by their address, listings and conversations by id. */
export type ReportTarget =
  | { kind: "ARTIST" | "VENUE"; slug: string }
  | { kind: "LISTING" | "CONVERSATION"; id: string };

export const REPORT_REASONS: ReportReason[] = ["SPAM", "FRAUD", "OFFENSIVE", "IMPERSONATION", "MISLEADING", "OTHER"];
const MAX_DESCRIPTION = 1000;

/** The report form; after sending it only says thank you (the outcome is never shown to the reporter). */
export function ReportDialog({ target, open, onClose }: { target: ReportTarget; open: boolean; onClose: () => void }) {
  const t = useTranslations("common");
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      {open && (
        <DialogContent closeLabel={t("close")} className="max-h-[90vh] overflow-y-auto rounded-none border-2 border-border">
          <ReportForm target={target} onClose={onClose} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function ReportForm({ target, onClose }: { target: ReportTarget; onClose: () => void }) {
  const t = useTranslations("report");
  const tr = useTranslations();
  const id = useId();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<{ field: "reason" | "description" | "form"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle className="uppercase">{t("thanksTitle")}</DialogTitle>
          <DialogDescription>{t("thanks")}</DialogDescription>
        </DialogHeader>
        <Button type="button" className="self-start" onClick={onClose}>
          {t("close")}
        </Button>
      </div>
    );
  }

  async function submit() {
    if (reason === null) {
      setError({ field: "reason", message: t("reasonRequired") });
      return;
    }
    if (reason === "OTHER" && description.trim() === "") {
      setError({ field: "description", message: t("descriptionRequired") });
      return;
    }
    setBusy(true);
    try {
      const body: ReportRequest = { ...target, reason, description: description.trim() || undefined };
      unwrap(await api.POST("/api/v1/reports", { body }));
      setSent(true);
    } catch (failure) {
      const problem = toApiProblem(failure);
      const field = problem.errors?.[0]?.field === "description" ? "description" : "form";
      setError({ field, message: problemMessage(tr, failure) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <DialogHeader>
        <DialogTitle className="uppercase">{t(`title.${target.kind}`)}</DialogTitle>
        <DialogDescription>{t("hint")}</DialogDescription>
      </DialogHeader>
      <fieldset className="flex flex-col gap-2" aria-describedby={error?.field === "reason" ? `${id}-reason` : undefined}>
        <legend className="mb-2 text-sm font-bold uppercase">{t("reasonLabel")}</legend>
        {REPORT_REASONS.map((option) => (
          <label
            key={option}
            className={cn(
              "flex cursor-pointer items-start gap-3 border-2 p-2 text-sm",
              reason === option ? "border-primary" : "border-border",
            )}
          >
            <input
              type="radio"
              name={`${id}-reason`}
              value={option}
              checked={reason === option}
              className="mt-0.5 accent-primary"
              onChange={() => {
                setReason(option);
                setError(null);
              }}
            />
            <span className="flex flex-col">
              <span className="font-bold">{t(`reason.${option}`)}</span>
              <span className="text-xs text-muted-foreground">{t(`reasonHint.${option}`)}</span>
            </span>
          </label>
        ))}
        {error?.field === "reason" && <FieldError id={`${id}-reason`} message={error.message} />}
      </fieldset>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-description`}>
          {reason === "OTHER" ? t("descriptionRequiredLabel") : t("descriptionLabel")}
        </Label>
        <Textarea
          id={`${id}-description`}
          rows={4}
          maxLength={MAX_DESCRIPTION}
          value={description}
          aria-invalid={error?.field === "description" || undefined}
          aria-describedby={error?.field === "description" ? `${id}-description-error` : undefined}
          onChange={(event) => {
            setDescription(event.target.value);
            if (error?.field === "description") setError(null);
          }}
        />
        {error?.field === "description" && <FieldError id={`${id}-description-error`} message={error.message} />}
      </div>
      {error?.field === "form" && <FieldError id={`${id}-form`} message={error.message} />}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? t("sending") : t("send")}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}

function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} role="alert" className="flex items-start gap-1.5 text-sm text-danger">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}
