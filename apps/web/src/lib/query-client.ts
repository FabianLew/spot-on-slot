import { MutationCache, QueryClient } from "@tanstack/react-query";
import { toApiProblem, type ApiProblem } from "./api-error";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: { handlesErrors?: boolean };
  }
}

export function createQueryClient(onMutationError: (problem: ApiProblem) => void): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          const { status } = toApiProblem(error);
          if (status >= 400 && status < 500) return false;
          return failureCount < 2;
        },
      },
    },
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (mutation.meta?.handlesErrors === true) return;
        onMutationError(toApiProblem(error));
      },
    }),
  });
}
