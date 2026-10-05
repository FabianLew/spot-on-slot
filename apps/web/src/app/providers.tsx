"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Toaster, toast } from "@spot-on-slot/ui";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { fallbackMessage } from "@/lib/problem-text";
import { createQueryClient } from "@/lib/query-client";

function ThemedToaster() {
  const t = useTranslations("common");
  const { resolvedTheme } = useTheme();
  // resolvedTheme is undefined until mounted; toasts only render after client interaction.
  return (
    <Toaster
      theme={resolvedTheme === "dark" || resolvedTheme === "light" ? resolvedTheme : "system"}
      containerAriaLabel={t("notifications")}
    />
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const t = useTranslations();
  // The client is created once; `latest` keeps the toast text in the active language.
  const latest = useRef(t);
  useEffect(() => {
    latest.current = t;
  }, [t]);
  // The callback only runs on mutation failure, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [queryClient] = useState(() =>
    createQueryClient((problem) => {
      toast.error(problem.detail || problem.title || fallbackMessage(latest.current, problem));
    }),
  );
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <ThemedToaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
