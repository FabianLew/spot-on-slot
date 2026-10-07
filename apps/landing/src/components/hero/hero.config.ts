/** Yellow base image; the red one shows inside the cursor spotlight. */
export const HERO_BASE_IMAGE = "/hero/base.webp";
export const HERO_REVEAL_IMAGE = "/hero/reveal.webp";
export const HERO_CTA_COLOR = "#ff261f";
export const HERO_CTA_HOVER_COLOR = "#d91f17";
/** The hard pixel shadow under the CTA, in the arcade yellow. */
export const HERO_CTA_SHADOW_COLOR = "#ffd400";
export const SPOTLIGHT_R = 260;
/** `key` is the `nav.*` message key, `href` the section anchor on the page. */
export const NAV_ITEMS = [
  { key: "audiences", href: "#audiences" },
  { key: "howItWorks", href: "#how-it-works" },
  { key: "waitlist", href: "#waitlist" },
  { key: "faq", href: "#faq" },
] as const;
export const ACTIVE_NAV_ITEM: (typeof NAV_ITEMS)[number]["key"] = "audiences";
/** DOM id of the hero section; the nav observes it to switch to a solid background below the hero. */
export const HERO_SECTION_ID = "hero";
