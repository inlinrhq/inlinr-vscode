import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installBinary } from "./dependencies";

let dir: string;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(tmpdir(), "inlinr-install-"));
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("installBinary", () => {
  it("installs the binary and leaves no download behind", async () => {
    const bin = path.join(dir, "inlinr");
    await installBinary(bin, Buffer.from("cli"));
    expect(await fs.readFile(bin, "utf8")).toBe("cli");
    expect(await fs.readdir(dir)).toEqual(["inlinr"]);
  });

  it("survives two windows installing at once", async () => {
    const bin = path.join(dir, "inlinr");
    await Promise.all([
      installBinary(bin, Buffer.from("cli")),
      installBinary(bin, Buffer.from("cli")),
      installBinary(bin, Buffer.from("cli")),
    ]);
    expect(await fs.readFile(bin, "utf8")).toBe("cli");
    expect(await fs.readdir(dir)).toEqual(["inlinr"]);
  });

  it("fails when nothing could be installed", async () => {
    const bin = path.join(dir, "missing", "inlinr");
    await expect(installBinary(bin, Buffer.from("cli"))).rejects.toThrow();
  });
});
