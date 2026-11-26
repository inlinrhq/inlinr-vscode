import { tmpdir } from "node:os";

/**
 * The one project the time of every temporary folder goes to. inlinr marks
 * this name "Temporary?" (`looksTemporary` in inlinr-web).
 */
export const SCRATCH_PROJECT = "scratch";

/**
 * Is this folder one agents and quick tests work in: the system's temporary
 * folder, a scratchpad, Claude Code's worktrees, a cache?
 *
 * Here it is asked of a workspace folder with no git remote, which would
 * otherwise become a project named after it (`wt-1188m`, `kw-2202`); it
 * goes to `SCRATCH_PROJECT` instead. A folder with a remote stays its
 * repository's. The same rule as the Claude Code plugin's
 * `src/temporary.ts` (inlinr-claude-code), which asks it of a repository's
 * root. No vscode import.
 */
export function isTemporaryRoot(root: string, temp = tmpdir()): boolean {
  const norm = (p: string) =>
    p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  const path = norm(root);
  const system = norm(temp);
  if (system && (path === system || path.startsWith(`${system}/`))) {
    return true;
  }
  if (
    /^(\/private)?\/(tmp|var\/tmp|var\/folders)(\/|$)/.test(path) ||
    /^[a-z]:\/(windows\/)?te?mp(\/|$)/.test(path)
  ) {
    return true;
  }
  const parts = path.split("/");
  return parts.some(
    (s, i) =>
      s === "scratchpad" ||
      s === ".cache" ||
      (s === ".claude" && parts[i + 1] === "worktrees") ||
      (s === "appdata" && parts[i + 1] === "local" && parts[i + 2] === "temp"),
  );
}
