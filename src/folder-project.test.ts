import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
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
    const parent = mkdtempSync(join(tmpdir(), "folder-"));
    try {
      expect(folderProjectName(parent, "/home/me")).not.toBeNull();
      mkdirSync(join(parent, "api", ".git"), { recursive: true });
      expect(folderProjectName(parent, "/home/me")).toBeNull();
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("refuses a home folder in the temporary folder", () => {
    expect(folderProjectName("/tmp", "/tmp", "/tmp")).toBeNull();
  });

  it("sends every temporary folder as one scratch project", () => {
    expect(folderProjectName("/tmp/kw-2202", "/home/me")).toBe("scratch");
    expect(
      folderProjectName("/home/me/app/.claude/worktrees/wt-1188m", "/home/me"),
    ).toBe("scratch");
  });
});
