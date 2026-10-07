import { describe, expect, it } from "vitest";
import { liveUrl, secondsLeft } from "./live-client";

describe("liveUrl", () => {
  it("derives the WebSocket address from the API address", () => {
    expect(liveUrl("http://localhost:8080")).toBe("ws://localhost:8080/ws");
    expect(liveUrl("https://api.spotonslot.pl/")).toBe("wss://api.spotonslot.pl/ws");
  });
});

describe("secondsLeft", () => {
  const token = (payload: object) => `x.${btoa(JSON.stringify(payload)).replace(/=+$/, "")}.y`;

  it("reads the expiry of a JWT", () => {
    expect(secondsLeft(token({ exp: 1_000 }), 990_000)).toBe(10);
    expect(secondsLeft(token({ exp: 1_000 }), 1_010_000)).toBe(-10);
  });

  it("gives null for a token it cannot read", () => {
    expect(secondsLeft("nonsense")).toBeNull();
    expect(secondsLeft(token({ sub: "u1" }))).toBeNull();
  });
});
