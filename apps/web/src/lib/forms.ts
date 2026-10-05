import { get, type FieldValues, type Path, type UseFormReturn } from "react-hook-form";
import type { ApiProblem } from "./api-error";

/**
 * Pins `errors[]` of a problem onto the form's fields. Entries for fields the form does not know,
 * and problems without field errors, become the form's root error (`root.server`).
 */
function normalizePath(path: string): string {
  return path.replace(/\[(\w+)\]/g, ".$1").replace(/^\./, "");
}

/**
 * A field is known when it is registered in the form or already holds a value. The registered-name
 * set (`control._names.mount`) is react-hook-form internal API, so it is read only here.
 */
function isKnownField<T extends FieldValues>(form: UseFormReturn<T>, path: string): boolean {
  const mounted = (form.control as { _names?: { mount?: Set<string> } })._names?.mount;
  return mounted?.has(path) === true || get(form.getValues(), path) !== undefined;
}

export function applyServerErrors<T extends FieldValues>(form: UseFormReturn<T>, problem: ApiProblem): void {
  const unknown: string[] = [];
  for (const entry of problem.errors ?? []) {
    const field = normalizePath(entry.field);
    if (isKnownField(form, field)) {
      form.setError(field as Path<T>, { type: "server", message: entry.message });
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
