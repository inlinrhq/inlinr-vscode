import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { folderProjectName } from "./folder-project";

describe("folderProjectName", () => {
  it("names a folder after its last segment", () => {
    expect(folderProjectName("/home/me/notes", "/home/me")).toBe("notes");
    expect(folderProjectName("/home/me/notes/", "/home/me")).toBe("notes");
  });

  it("refuses the home folder and the root", () => {
    expect(folderProjectName("/home/me", "/home/me")).toBeNull();
    expect(folderProjectName("/home/me/", "/home/me")).toBeNull();
    expect(folderProjectName("/", "/home/me")).toBeNull();
  });

  it("refuses a folder that holds repositories", () => {
    const parent = mkdtempSync(join(tmpdir(), "inlinr-"));
    expect(folderProjectName(parent, "/home/me")).not.toBeNull();
    mkdirSync(join(parent, "api", ".git"), { recursive: true });
    expect(folderProjectName(parent, "/home/me")).toBeNull();
  });
});
