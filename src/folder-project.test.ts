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
});
