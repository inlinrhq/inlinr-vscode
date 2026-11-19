import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installBinary } from "./dependencies";

vi.mock("node:fs/promises", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:fs/promises")>();
  return { ...real, rename: vi.fn(real.rename) };
});

let dir: string;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "inlinr-install-"));
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("installBinary", () => {
  it("writes the binary and leaves no temporary file", async () => {
    const bin = path.join(dir, "inlinr");
    await installBinary(bin, Buffer.from("v1"));
    expect(await fs.readFile(bin, "utf8")).toBe("v1");
    expect(await fs.readdir(dir)).toEqual(["inlinr"]);
  });

  it("two windows installing at once both succeed", async () => {
    const bin = path.join(dir, "inlinr");
    await Promise.all([
      installBinary(bin, Buffer.from("v1")),
      installBinary(bin, Buffer.from("v1")),
    ]);
    expect(await fs.readFile(bin, "utf8")).toBe("v1");
  });

  it("a rename lost to another window is not an error", async () => {
    const bin = path.join(dir, "inlinr");
    await fs.writeFile(bin, "v1");
    const enoent = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    vi.mocked(fs.rename).mockRejectedValueOnce(enoent);
    await installBinary(bin, Buffer.from("v1"));
    expect(await fs.readdir(dir)).toEqual(["inlinr"]);
  });

  it("a rename that fails with no binary in place still throws", async () => {
    const bin = path.join(dir, "inlinr");
    const enoent = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    vi.mocked(fs.rename).mockRejectedValueOnce(enoent);
    await expect(installBinary(bin, Buffer.from("v1"))).rejects.toThrow(
      "ENOENT",
    );
  });
});
