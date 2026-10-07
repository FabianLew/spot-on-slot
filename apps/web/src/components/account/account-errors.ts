import { toApiProblem } from "@spot-on-slot/api-client";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { showServerError } from "@/components/auth/server-error";

/**
 * Server errors of the password-protected account forms: a wrong password lands on its field (the backend names it),
 * too many attempts becomes the form's own message.
 */
export function showAccountError<T extends FieldValues>(form: UseFormReturn<T>, failure: unknown, t: unknown) {
  const problem = toApiProblem(failure);
  if (problem.code === "ACCOUNT_TOO_MANY_ATTEMPTS") {
    form.setError("root.server", { type: "server", message: (t as (key: string) => string)("account.tooManyAttempts") });
    return;
  }
  showServerError(form, problem, t);
}
