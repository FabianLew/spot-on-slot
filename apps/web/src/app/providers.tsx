"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useState, type ReactNode } from "react";
import { Toaster } from "@spot-on-slot/ui";
import { ThemeProvider } from "@/components/theme/theme-provider";

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
  const [queryClient] = useState(() => new QueryClient());
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <ThemedToaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
