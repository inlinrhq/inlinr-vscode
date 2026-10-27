// The project of a workspace folder with no git remote: its name.
//
// Such a folder used to be dropped without a word, so a notes folder, a
// script collection or a repository not pushed yet never showed any time.
// No vscode import, so it can be tested on its own.

import * as path from "node:path";

/**
 * The folder's name, sent as `--project`, or null when the folder is too
 * broad to be a project: the home folder or a drive's root. Only the name
 * leaves the machine, never the path.
 */
export function folderProjectName(
  folderPath: string,
  home: string,
): string | null {
  const resolved = path.resolve(folderPath);
  if (path.dirname(resolved) === resolved) return null;
  if (samePath(resolved, path.resolve(home))) return null;
  const name = path.basename(resolved).trim();
  return name || null;
}

function samePath(a: string, b: string): boolean {
  // Windows and macOS paths are case-insensitive.
  return process.platform === "linux"
    ? a === b
    : a.toLowerCase() === b.toLowerCase();
}
