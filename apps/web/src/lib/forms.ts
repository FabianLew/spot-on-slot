import { get, type FieldValues, type Path, type UseFormReturn } from "react-hook-form";
import type { ApiProblem } from "./api-error";

/**
 * Pins `errors[]` of a problem onto the form's fields. Entries for fields the form does not know,
 * and problems without field errors, become the form's root error (`root.server`).
 */
export function applyServerErrors<T extends FieldValues>(form: UseFormReturn<T>, problem: ApiProblem): void {
  const values = form.getValues();
  const unknown: string[] = [];
  for (const entry of problem.errors ?? []) {
    if (get(values, entry.field) !== undefined) {
      form.setError(entry.field as Path<T>, { type: "server", message: entry.message });
    } else {
      unknown.push(entry.message);
    }
  }
  const message = problem.errors?.length ? unknown[0] : problem.detail || problem.title;
  if (message) form.setError("root.server", { type: "server", message });
}

type Translate = ((key: string) => string) & { has: (key: string) => boolean };

/** Translates `validation.*` keys from schemas; server messages are already localized and pass through. */
export function translateFormError(t: unknown): (message: string) => string {
  const tr = t as Translate;
  return (message) => (message.startsWith("validation.") && tr.has(message) ? tr(message) : message);
}
