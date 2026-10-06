// The skip is a per-browser convenience (spec W2): storage may be missing or blocked, so every access is guarded.
const key = (userId: string) => `sos.onboarding.skipped.${userId}`;

export function isOnboardingSkipped(userId: string): boolean {
  try {
    return window.localStorage.getItem(key(userId)) === "1";
  } catch {
    return false;
  }
}

export function skipOnboarding(userId: string): void {
  try {
    window.localStorage.setItem(key(userId), "1");
  } catch {
    // Without storage the wizard simply shows up again next time.
  }
}
