import { z } from "zod";

// Mirrors the backend rules (identity RegisterRequest / PasswordResetConfirmRequest); the server stays the authority.
const email = z.string().trim().min(1, "validation.required").pipe(z.email("validation.email"));
const newPassword = z.string().min(10, "validation.passwordTooShort").max(128, "validation.passwordTooLong");

export const REGISTER_ROLES = ["ARTIST", "VENUE"] as const;
export type RegisterRole = (typeof REGISTER_ROLES)[number];

export const emailSchema = z.object({ email });
export type EmailValues = z.infer<typeof emailSchema>;

export const loginSchema = z.object({ email, password: z.string().min(1, "validation.required") });
export type LoginValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    email,
    password: newPassword,
    passwordRepeat: z.string(),
    privacyNoticeAccepted: z.boolean().refine((v) => v, "validation.privacyRequired"),
  })
  .refine((v) => v.password === v.passwordRepeat, { path: ["passwordRepeat"], message: "validation.passwordMismatch" })
  .refine((v) => v.password.trim().toLowerCase() !== v.email.toLowerCase(), {
    path: ["password"],
    message: "validation.passwordEqualsEmail",
  });
export type RegisterValues = z.infer<typeof registerSchema>;

export const resetPasswordSchema = z
  .object({ password: newPassword, passwordRepeat: z.string() })
  .refine((v) => v.password === v.passwordRepeat, { path: ["passwordRepeat"], message: "validation.passwordMismatch" });
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
