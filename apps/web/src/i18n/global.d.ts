import type { Locale } from "@spot-on-slot/shared";
import type pl from "../../messages/pl.json";

declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof pl;
  }
}
