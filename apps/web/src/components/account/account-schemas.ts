import { z } from "zod";

// Mirrors the backend rules (identity ChangePasswordRequest / ChangeEmailRequest / DeletionRequest).
const currentPassword = z.string().min(1, "validation.required");

export const passwordSchema = z
  .object({
    currentPassword,
    newPassword: z.string().min(10, "validation.passwordTooShort").max(128, "validation.passwordTooLong"),
    passwordRepeat: z.string(),
  })
  .refine((v) => v.newPassword === v.passwordRepeat, { path: ["passwordRepeat"], message: "validation.passwordMismatch" });
export type PasswordValues = z.infer<typeof passwordSchema>;

export const emailChangeSchema = z.object({
  newEmail: z.string().trim().min(1, "validation.required").pipe(z.email("validation.email")),
  currentPassword,
});
export type EmailChangeValues = z.infer<typeof emailChangeSchema>;

export const deletionSchema = z.object({
  password: currentPassword,
  confirm: z.boolean().refine((v) => v, "validation.confirmDeletion"),
});
export type DeletionValues = z.infer<typeof deletionSchema>;
