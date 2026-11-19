// The machine's pause, read from the CLI's config.toml (`[behavior]`
// `paused` / `paused_until`, written by `inlinr pause`). Every inlinr plugin
// on the machine follows it: the CLI drops this editor's beats, the Claude
// Code plugin sends nothing. No vscode import, so it is tested on its own.

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

/** Until when tracking is paused: null when it is not, Infinity with no end. */
export function pausedUntil(
  configToml: string | null,
  now: number,
): number | null {
  const text = configToml ?? "";
  const header = /^\s*\[behavior\]\s*(#.*)?$/m.exec(text);
  if (!header) return null;
  const start = header.index + header[0].length;
  const next = /^\s*\[/m.exec(text.slice(start));
  const table = text.slice(start, next ? start + next.index : text.length);
  const until =
    /^\s*paused_until\s*=\s*["']?([0-9T:.+\-Z ]+?)["']?\s*(#.*)?$/m.exec(
      table,
    )?.[1];
  const end = until ? Date.parse(until) : Number.NaN;
  if (Number.isFinite(end) && end > now) return end;
  return /^\s*paused\s*=\s*true\b/m.test(table)
    ? Number.POSITIVE_INFINITY
    : null;
}

export async function readPausedUntil(
  now = Date.now(),
): Promise<number | null> {
  const home = process.env.INLINR_HOME || path.join(os.homedir(), ".inlinr");
  const text = await fs
    .readFile(path.join(home, "config.toml"), "utf8")
    .catch(() => null);
  return pausedUntil(text, now);
}

/** The choices of Pause tracking, as `inlinr pause --for` takes them. */
export const PAUSE_CHOICES = [
  { label: "For 30 minutes", for: "30m" },
  { label: "For 1 hour", for: "1h" },
  { label: "For 2 hours", for: "2h" },
  { label: "Until I resume", for: "" },
] as const;
