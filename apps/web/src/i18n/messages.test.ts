import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import pl from "../../messages/pl.json";

function flatten(obj: Record<string, unknown>, prefix = ""): [string, unknown][] {
  return Object.entries(obj).flatMap(([key, value]) =>
    value !== null && typeof value === "object"
      ? flatten(value as Record<string, unknown>, `${prefix}${key}.`)
      : [[`${prefix}${key}`, value] as [string, unknown]],
  );
}

describe("messages", () => {
  const plEntries = flatten(pl);
  const enEntries = flatten(en);

  it("pl and en have identical keys", () => {
    expect(enEntries.map(([k]) => k).sort()).toEqual(plEntries.map(([k]) => k).sort());
  });
  it("has no empty values", () => {
    for (const [key, value] of [...plEntries, ...enEntries]) {
      expect(value, key).not.toBe("");
    }
  });
});
