"use client";

import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Button, Panel, toast } from "@spot-on-slot/ui";
import { useSession } from "@/components/session/session-provider";
import { problemMessage } from "@/lib/problem-text";
import { DeleteAccountDialog } from "./delete-account-dialog";
import { EmailChangeDialog } from "./email-change-dialog";
import { downloadPersonalData } from "./export-data";
import { PasswordDialog } from "./password-dialog";

type DialogName = "email" | "password" | "delete" | null;

/**
 * "Ustawienia → Konto": e-mail, password, data export and, set apart at the end of the page, deleting the account.
 * `children` (the other settings panels) go between the two.
 */
export function AccountSettings({ children }: { children?: ReactNode }) {
  const t = useTranslations();
  const { session } = useSession();
  const [dialog, setDialog] = useState<DialogName>(null);
  const [exporting, setExporting] = useState(false);
  const close = () => setDialog(null);
  const email = session.status === "authenticated" ? session.user.email : "";

  async function exportData() {
    setExporting(true);
    try {
      await downloadPersonalData();
      toast.success(t("account.export.done"));
    } catch (failure) {
      toast.error(problemMessage(t, failure));
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <Panel title={t("account.title")}>
        <p className="text-sm text-muted-foreground">{t("account.description")}</p>
        <div className="flex flex-col divide-y-2 divide-border border-y-2 border-border">
          <Row label={t("account.email.label")} value={<span className="break-all">{email}</span>}>
            <Button type="button" variant="outline" onClick={() => setDialog("email")}>
              {t("account.email.change")}
            </Button>
          </Row>
          <Row label={t("account.password.label")} value={<span aria-hidden="true">••••••••••</span>}>
            <Button type="button" variant="outline" onClick={() => setDialog("password")}>
              {t("account.password.change")}
            </Button>
          </Row>
          <Row label={t("account.export.label")} value={<span className="text-muted-foreground">{t("account.export.hint")}</span>}>
            <Button type="button" variant="outline" onClick={exportData} disabled={exporting}>
              {exporting ? t("account.export.downloading") : t("account.export.download")}
            </Button>
          </Row>
        </div>
      </Panel>
      {children}
      <Panel
        title={
          <span className="flex items-center gap-2 text-danger">
            <CircleAlert className="size-5 shrink-0" aria-hidden="true" />
            {t("account.delete.section")}
          </span>
        }
        className="border-danger"
      >
        <p className="text-sm">{t("account.delete.text")}</p>
        <Button type="button" variant="destructive" className="self-start" onClick={() => setDialog("delete")}>
          {t("account.delete.open")}
        </Button>
      </Panel>
      <EmailChangeDialog open={dialog === "email"} onClose={close} />
      <PasswordDialog open={dialog === "password"} onClose={close} />
      <DeleteAccountDialog open={dialog === "delete"} onClose={close} />
    </>
  );
}

function Row({ label, value, children }: { label: string; value: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1 text-sm">
        <p className="font-bold uppercase text-muted-foreground">{label}</p>
        <p>{value}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
