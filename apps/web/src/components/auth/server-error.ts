import type { ApiProblem } from "@spot-on-slot/api-client";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { applyServerErrors } from "@spot-on-slot/ui";
import { fallbackMessage } from "@/lib/problem-text";

/** `applyServerErrors`, plus the translated fallback for problems without backend texts (e.g. offline). */
export function showServerError<T extends FieldValues>(form: UseFormReturn<T>, problem: ApiProblem, t: unknown) {
  if (problem.errors?.length || problem.detail || problem.title) {
    applyServerErrors(form, problem);
  } else {
    form.setError("root.server", { type: "server", message: fallbackMessage(t, problem) });
  }
}
