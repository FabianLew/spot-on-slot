"use client";

import { CircleAlert } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Label,
  Tag,
  Textarea,
  cn,
} from "@spot-on-slot/ui";
import { problemMessage } from "@/lib/problem-text";
import type { AccountState, ModerationAction, ReportKind } from "./queries";

export const MAX_REASON = 500;

/** Date and time in Warsaw, as everywhere in the app. */
export function useWhen() {
  const format = useFormatter();
  return (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" });
}

export function KindTag({ kind }: { kind: ReportKind }) {
  const t = useTranslations("admin.kind");
  return <Tag className="text-[0.625rem]">{t(kind)}</Tag>;
}

export function StateTag({ state }: { state: AccountState }) {
  const t = useTranslations("admin.state");
  return (
    <Tag className={cn("text-[0.625rem]", state === "BLOCKED" && "border-primary bg-primary text-primary-foreground")}>{t(state)}</Tag>
  );
}

/** A row of toggle buttons, one pressed (the filter of a list). */
export function FilterGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "-mr-0.5 -mb-0.5 border-2 border-border px-3 py-1.5 text-xs font-bold uppercase focus-visible:relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === option.value ? "border-primary bg-primary text-primary-foreground" : "bg-field hover:bg-muted",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** "Pokaż więcej" under a paged list. */
export function LoadMore({ show, loading, onClick }: { show: boolean; loading: boolean; onClick: () => void }) {
  const t = useTranslations("admin");
  if (!show) return null;
  return (
    <Button type="button" variant="outline" className="self-center" disabled={loading} onClick={onClick}>
      {loading ? t("loadingMore") : t("loadMore")}
    </Button>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">{children}</p>;
}

/** Admins' actions, newest first, with who did what, to whom and why. */
export function ActionList({ actions, links = true }: { actions: ModerationAction[]; links?: boolean }) {
  const t = useTranslations("admin");
  const when = useWhen();
  if (actions.length === 0) return <Empty>{t("history.empty")}</Empty>;
  return (
    <ol className="flex flex-col divide-y-2 divide-border border-2 border-border">
      {actions.map((action) => (
        <li key={action.id} className="flex flex-col gap-1 p-3 text-sm">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-bold uppercase">{t(`action.${action.type}`)}</span>
            {action.kind != null && <KindTag kind={action.kind} />}
            {links && action.subjectId != null ? (
              <Link href={`/admin/users/${action.subjectId}`} className="break-all underline">
                {action.subjectLabel}
              </Link>
            ) : (
              <span className="break-all">{action.subjectLabel}</span>
            )}
          </p>
          {action.reason != null && <p className="break-words">{t("history.reason", { reason: action.reason })}</p>}
          <p className="text-xs text-muted-foreground">
            {t("history.by", { admin: action.adminEmail, when: when(action.createdAt) })}
          </p>
        </li>
      ))}
    </ol>
  );
}

export type ReasonRequest = {
  title: string;
  description: string;
  confirm: string;
  destructive?: boolean;
  /** Runs the action; a failure stays in the dialog with the backend's text. */
  run: (reason: string) => Promise<void>;
};

/** Asks for the reason every admin action needs (kept in the history, shown to the owner for hiding and blocks). */
export function ReasonDialog({ request, onClose }: { request: ReasonRequest | null; onClose: () => void }) {
  const t = useTranslations("common");
  return (
    <Dialog open={request !== null} onOpenChange={(next) => !next && onClose()}>
      {request && (
        <DialogContent closeLabel={t("close")} className="rounded-none border-2 border-border">
          <ReasonForm key={request.title} request={request} onClose={onClose} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function ReasonForm({ request, onClose }: { request: ReasonRequest; onClose: () => void }) {
  const t = useTranslations();
  const id = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (reason.trim() === "") {
          setError(t("validation.required"));
          return;
        }
        setBusy(true);
        try {
          await request.run(reason.trim());
          onClose();
        } catch (failure) {
          setError(problemMessage(t, failure));
        } finally {
          setBusy(false);
        }
      }}
    >
      <DialogHeader>
        <DialogTitle className="uppercase">{request.title}</DialogTitle>
        <DialogDescription>{request.description}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor={id}>{t("admin.reasonLabel")}</Label>
        <Textarea
          id={id}
          rows={3}
          maxLength={MAX_REASON}
          value={reason}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => {
            setReason(event.target.value);
            setError(null);
          }}
        />
        {error && (
          <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm text-danger">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant={request.destructive ? "destructive" : "default"} disabled={busy}>
          {request.confirm}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("admin.cancel")}
        </Button>
      </div>
    </form>
  );
}
