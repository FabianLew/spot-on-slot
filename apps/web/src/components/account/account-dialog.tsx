"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@spot-on-slot/ui";

/** Arcade-framed dialog of the account panel; the body mounts only while open, so forms start empty. */
export function AccountDialog({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const t = useTranslations("common");
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      {open && (
        <DialogContent
          closeLabel={t("close")}
          className="max-h-[90vh] overflow-y-auto rounded-none border-2 border-border"
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <DialogHeader>
            <DialogTitle className="uppercase">{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {children}
        </DialogContent>
      )}
    </Dialog>
  );
}
