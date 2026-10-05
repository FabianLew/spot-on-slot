export const HERO_BASE_IMAGE = "/hero/base.jpg";
export const HERO_REVEAL_IMAGE = "/hero/reveal.jpg";
export const HERO_CTA_COLOR = "#dc2626";
export const HERO_CTA_HOVER_COLOR = "#b91c1c";
export const SPOTLIGHT_R = 260;
/** `key` is the `nav.*` message key, `href` the section anchor on the page. */
export const NAV_ITEMS = [
  { key: "audiences", href: "#audiences" },
  { key: "howItWorks", href: "#how-it-works" },
  { key: "waitlist", href: "#waitlist" },
  { key: "faq", href: "#faq" },
] as const;
export const ACTIVE_NAV_ITEM: (typeof NAV_ITEMS)[number]["key"] = "audiences";
