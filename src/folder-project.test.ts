import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
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
    // Not in the temporary folder, which is refused on its own.
    const parent = mkdtempSync(join(process.cwd(), ".test-folder-"));
    try {
      expect(folderProjectName(parent, "/home/me")).not.toBeNull();
      mkdirSync(join(parent, "api", ".git"), { recursive: true });
      expect(folderProjectName(parent, "/home/me")).toBeNull();
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("refuses a temporary folder", () => {
    expect(folderProjectName("/tmp/kw-2202", "/home/me")).toBeNull();
    expect(
      folderProjectName("/home/me/app/.claude/worktrees/wt-1188m", "/home/me"),
    ).toBeNull();
  });
});
