import type { ApiProblem } from "./api-error";

type Translate = ((key: string) => string) & { has: (key: string) => boolean };

/** Message for a problem without backend texts: `errors.<code>` when translated, else `errors.INTERNAL_ERROR`. */
export function fallbackMessage(t: unknown, problem: ApiProblem): string {
  const tr = t as Translate;
  const key = `errors.${problem.code}`;
  return tr(tr.has(key) ? key : "errors.INTERNAL_ERROR");
}
