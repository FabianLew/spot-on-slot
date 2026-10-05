import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import pl from "../../../messages/pl.json";
import { isActive } from "./is-active";
import { navIcons } from "./nav-icons";
import { navItems } from "./nav-items";

describe("navItems", () => {
  it("lists 8 sections with 4 phone tabs in order", () => {
    expect(navItems).toHaveLength(8);
    expect(navItems.filter((i) => i.mobile === "tab").map((i) => i.href)).toEqual([
      "/dashboard",
      "/calendar",
      "/search",
      "/messages",
    ]);
  });
  it("has translations for every label key in both languages", () => {
    for (const item of navItems) {
      expect(pl.nav).toHaveProperty(item.labelKey);
      expect(en.nav).toHaveProperty(item.labelKey);
    }
  });
  it("is plain serializable data that can cross the server/client boundary", () => {
    expect(structuredClone(navItems)).toEqual(navItems);
    expect(JSON.parse(JSON.stringify(navItems))).toEqual(navItems);
  });
  it("resolves every icon name to a component", () => {
    for (const item of navItems) {
      expect(navIcons[item.icon], item.icon).toBeDefined();
    }
  });
  it("has a page on disk for every href", () => {
    for (const item of navItems) {
      expect(existsSync(join(process.cwd(), "src/app/(app)", item.href, "page.tsx")), item.href).toBe(true);
    }
  });
});

describe("isActive", () => {
  it("matches exact and nested paths but not prefixes of other segments", () => {
    expect(isActive("/dashboard", "/dashboard")).toBe(true);
    expect(isActive("/settings/notifications", "/settings")).toBe(true);
    expect(isActive("/dashboard-x", "/dashboard")).toBe(false);
  });
});
