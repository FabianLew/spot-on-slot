import { describe, expect, it } from "vitest";
import { addDays, addMonths, daysInMonth, instantAt, local, startOfWeek, weekdayIndex } from "./warsaw-time";

describe("warsaw time", () => {
  it("converts wall clock to instants on both sides of the clock change", () => {
    expect(instantAt("2026-10-23", "21:00").toISOString()).toBe("2026-10-23T19:00:00.000Z");
    expect(instantAt("2026-10-30", "21:00").toISOString()).toBe("2026-10-30T20:00:00.000Z");
    expect(instantAt("2026-03-29", "03:30").toISOString()).toBe("2026-03-29T01:30:00.000Z");
  });

  it("reads instants back as local day and time", () => {
    expect(local("2026-10-23T22:30:00Z")).toEqual({ day: "2026-10-24", time: "00:30" });
    expect(local("2026-12-31T23:00:00Z")).toEqual({ day: "2027-01-01", time: "00:00" });
  });

  it("walks days, weeks and months", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(weekdayIndex("2026-10-12")).toBe(0);
    expect(startOfWeek("2026-10-18")).toBe("2026-10-12");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-01");
    expect(daysInMonth("2028-02-10")).toBe(29);
  });
});
