export const PRIVACY_CONTROLLER_PLACEHOLDER = "[administrator danych]";
export const PRIVACY_EMAIL_PLACEHOLDER = "[e-mail kontaktowy]";

export type PrivacyConfig = {
  controller: string;
  email: string;
  isPlaceholder: boolean;
};

/**
 * Data controller shown in the privacy clause and the footer. Missing values are replaced
 * with visible placeholders in dev/CI; production builds fail without them (next.config.ts).
 */
export function getPrivacyConfig(): PrivacyConfig {
  // Direct property access so Next inlines the NEXT_PUBLIC_ values at build time.
  const controller = process.env.NEXT_PUBLIC_PRIVACY_CONTROLLER?.trim();
  const email = process.env.NEXT_PUBLIC_PRIVACY_EMAIL?.trim();
  return {
    controller: controller || PRIVACY_CONTROLLER_PLACEHOLDER,
    email: email || PRIVACY_EMAIL_PLACEHOLDER,
    isPlaceholder: !controller || !email,
  };
}
