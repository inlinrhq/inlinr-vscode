import { describe, expect, it } from "vitest";
import { pausedUntil } from "./pause";

const now = Date.parse("2026-11-19T10:00:00Z");

describe("pausedUntil", () => {
  it("is null with no pause", () => {
    expect(pausedUntil(null, now)).toBeNull();
    expect(pausedUntil('[auth]\ndevice_token = "x"\n', now)).toBeNull();
    expect(pausedUntil("[behavior]\npaused = false\n", now)).toBeNull();
  });

  it("has no end after a plain inlinr pause", () => {
    expect(pausedUntil("[behavior]\npaused = true\n", now)).toBe(
      Number.POSITIVE_INFINITY,
    );
  });

  it("ends when inlinr pause --for says", () => {
    const text = "[behavior]\npaused_until = 2026-11-19T11:00:00Z\n";
    expect(pausedUntil(text, now)).toBe(Date.parse("2026-11-19T11:00:00Z"));
    expect(pausedUntil(text, Date.parse("2026-11-19T11:00:00Z"))).toBeNull();
  });

  it("reads only the [behavior] table", () => {
    expect(
      pausedUntil("[behavior]\n[logging]\npaused = true\n", now),
    ).toBeNull();
  });
});
