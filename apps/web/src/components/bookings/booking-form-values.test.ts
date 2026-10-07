import { describe, expect, it } from "vitest";
import { bookingSchema, toTerm, toTerms, toValues } from "./booking-form-values";

const free = { startsAt: "2026-10-23T19:00:00.000Z", endsAt: "2026-10-24T02:00:00.000Z" }; // 21:00–04:00 in Warsaw

const errors = (result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  result.success ? [] : result.error!.issues.map((issue) => `${issue.path.join(".")}:${issue.message}`);

describe("booking form values", () => {
  it("reads a term in Warsaw time and sends złote as grosze", () => {
    const values = toValues(free, 150000, "Hej");
    expect(values).toEqual({ date: "2026-10-23", from: "21:00", to: "04:00", amount: "1500", message: "Hej" });
    expect(toTerms({ ...values, message: "  " })).toEqual({ ...free, amount: 150000, message: undefined });
  });

  it("puts an end at or before the start on the next day", () => {
    expect(toTerm({ date: "2026-10-23", from: "22:00", to: "02:00" })).toEqual({
      startsAt: "2026-10-23T20:00:00.000Z",
      endsAt: "2026-10-24T00:00:00.000Z",
    });
  });

  it("keeps a venue's narrowed hours inside the artist's free time", () => {
    const schema = bookingSchema(free);
    const ok = { date: "2026-10-23", from: "22:00", to: "02:00", amount: "0", message: "" };
    expect(errors(schema.safeParse(ok))).toEqual([]);
    expect(errors(schema.safeParse({ ...ok, from: "20:00" }))).toEqual(["to:validation.outsideFree"]);
    expect(errors(schema.safeParse({ ...ok, to: "05:00" }))).toEqual(["to:validation.outsideFree"]);
  });

  it("checks the amount and the length", () => {
    const schema = bookingSchema();
    const ok = { date: "2026-10-23", from: "22:00", to: "02:00", amount: "100", message: "" };
    expect(errors(schema.safeParse({ ...ok, amount: "" }))).toEqual(["amount:validation.required"]);
    expect(errors(schema.safeParse({ ...ok, amount: "100001" }))).toEqual(["amount:validation.rateMax"]);
    expect(errors(schema.safeParse({ ...ok, amount: "1,5" }))).toEqual(["amount:validation.number"]);
    expect(errors(schema.safeParse({ ...ok, to: "22:15" }))).toEqual(["to:validation.duration"]);
  });
});
