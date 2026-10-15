"use client";

import { ApiErrorState } from "@/components/errors/api-error-state";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ApiErrorState error={error} onRetry={retry} />;
}
