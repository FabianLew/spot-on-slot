import { toApiProblem, type ApiProblem } from "@spot-on-slot/api-client";

type Translate = ((key: string) => string) & { has: (key: string) => boolean };

/** Message for a problem without backend texts: `errors.<code>` when translated, else `errors.INTERNAL_ERROR`. */
export function fallbackMessage(t: unknown, problem: ApiProblem): string {
  const tr = t as Translate;
  const key = `errors.${problem.code}`;
  return tr(tr.has(key) ? key : "errors.INTERNAL_ERROR");
}

/** One line for any failure: the backend's localized text, else the fallback. */
export function problemMessage(t: unknown, failure: unknown): string {
  const problem = toApiProblem(failure);
  return problem.detail || problem.title || fallbackMessage(t, problem);
}
