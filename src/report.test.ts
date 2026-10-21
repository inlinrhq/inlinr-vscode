import { describe, expect, it } from "vitest";
import {
  createReporter,
  isNetworkError,
  type Store,
  scrubHome,
  signature,
} from "./report";

function memory(): Store {
  const data = new Map<string, unknown>();
  return {
    get: <T>(k: string) => data.get(k) as T | undefined,
    update: async (k: string, v: unknown) => {
      data.set(k, v);
    },
  };
}

describe("isNetworkError", () => {
  it("knows a connection that never happened", () => {
    expect(isNetworkError(new TypeError("fetch failed"))).toBe(true);
    const dns = Object.assign(new Error("getaddrinfo"), { code: "ENOTFOUND" });
    expect(isNetworkError(dns)).toBe(true);
  });

  it("keeps what is the extension's problem", () => {
    const enoent = Object.assign(new Error("spawn inlinr ENOENT"), {
      code: "ENOENT",
    });
    expect(isNetworkError(enoent)).toBe(false);
    expect(isNetworkError(new Error("HTTP 404 for https://github.com/x"))).toBe(
      false,
    );
  });
});

describe("scrubHome", () => {
  it("replaces the home folder in both slash directions", () => {
    const home = "C:\\Users\\ana";
    expect(scrubHome("spawn C:\\Users\\ana\\x\\inlinr.exe EPERM", home)).toBe(
      "spawn ~\\x\\inlinr.exe EPERM",
    );
    expect(scrubHome("at C:/Users/ana/x.js:1", home)).toBe("at ~/x.js:1");
  });
});

describe("signature", () => {
  it("folds numbers that change per run", () => {
    expect(signature("heartbeat", "pid 41234")).toBe(
      signature("heartbeat", "pid 51001"),
    );
  });
});

describe("createReporter", () => {
  it("sends once a day, not when off, not for the network", () => {
    const sent: string[] = [];
    let now = 1_800_000_000_000;
    let on = true;
    const report = createReporter({
      enabled: () => on,
      store: memory(),
      version: "0.4.0",
      editor: "cursor",
      send: async (body) => {
        sent.push(body);
      },
      now: () => now,
    });

    report(
      "heartbeat",
      new Error("inlinr exited 2: flag provided but not defined"),
    );
    report(
      "heartbeat",
      new Error("inlinr exited 2: flag provided but not defined"),
    );
    expect(sent).toHaveLength(1);
    expect(JSON.parse(sent[0] ?? "{}")).toMatchObject({
      source: "vscode",
      version: "vscode-inlinr/0.4.0",
      editor: "cursor",
      context: "heartbeat",
      message: "inlinr exited 2: flag provided but not defined",
    });

    report("cli-download", new TypeError("fetch failed"));
    on = false;
    report("cli-download", new Error("HTTP 404"));
    expect(sent).toHaveLength(1);

    on = true;
    now += 25 * 60 * 60 * 1000;
    report(
      "heartbeat",
      new Error("inlinr exited 2: flag provided but not defined"),
    );
    expect(sent).toHaveLength(2);
  });
});
