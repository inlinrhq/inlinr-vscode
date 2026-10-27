// The project of a workspace folder with no git remote: its name.
//
// Such a folder used to be dropped without a word, so a notes folder, a
// script collection or a repository not pushed yet never showed any time.
// No vscode import, so it can be tested on its own.

import { existsSync, readdirSync } from "node:fs";
import * as path from "node:path";

/**
 * The folder's name, sent as `--project`, or null when the folder is too
 * broad to be a project: the home folder, a drive's root, or a folder that
 * holds repositories (the parent of several clones, whose files belong to
 * their own repositories). Only the name leaves the machine, never the path.
 */
export function folderProjectName(
  folderPath: string,
  home: string,
): string | null {
  const resolved = path.resolve(folderPath);
  if (path.dirname(resolved) === resolved) return null;
  if (samePath(resolved, path.resolve(home))) return null;
  if (holdsRepositories(resolved)) return null;
  const name = path.basename(resolved).trim();
  return name || null;
}

function samePath(a: string, b: string): boolean {
  // Windows and macOS paths are case-insensitive.
  return process.platform === "linux"
    ? a === b
    : a.toLowerCase() === b.toLowerCase();
}

/** A child folder is a git repository. Top level only, the first 500 entries. */
function holdsRepositories(folder: string): boolean {
  try {
    return readdirSync(folder, { withFileTypes: true })
      .slice(0, 500)
      .some(
        (e) => e.isDirectory() && existsSync(path.join(folder, e.name, ".git")),
      );
  } catch {
    return false;
  }
}
