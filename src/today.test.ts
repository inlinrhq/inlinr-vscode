import { describe, expect, it } from "vitest";
import { pickDeviceToken } from "./today";

describe("pickDeviceToken", () => {
  it("takes the machine's token from config.toml", () => {
    expect(
      pickDeviceToken(
        '[auth]\n  device_token = "in_d_cli"\n',
        '{"deviceToken":"in_d_plugin"}',
      ),
    ).toBe("in_d_cli");
  });

  it("falls back to an older Claude Code plugin's token", () => {
    expect(
      pickDeviceToken(
        '[auth]\n  device_token = ""\n',
        '{"deviceToken":"in_d_plugin"}',
      ),
    ).toBe("in_d_plugin");
    expect(pickDeviceToken(null, '{"deviceToken":"in_d_plugin"}')).toBe(
      "in_d_plugin",
    );
  });

  it("has none when neither file has one", () => {
    expect(pickDeviceToken(null, null)).toBeNull();
    expect(pickDeviceToken("", "not json")).toBeNull();
    expect(pickDeviceToken(null, '{"deviceToken":""}')).toBeNull();
  });
});
