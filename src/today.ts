// Polls GET /api/v1/me/today and formats the result for the status bar.
//
// Reads the machine's device token from the CLI's config file
// (~/.inlinr/config.toml), the one every inlinr plugin on the machine shares.
// We don't re-implement TOML parsing — just grep the key we need. A machine
// connected by a Claude Code plugin older than 0.7.0 has it only in
// ~/.inlinr/claude-code.json, which the CLI also falls back to. If neither
// has one we return null and the status bar shows a hint.

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { OutputChannel } from "vscode";

export type TodayResponse = {
  seconds: number;
  beats: number;
  top_projects: { name: string; seconds: number }[];
  by_category: { name: string; seconds: number }[];
};

const CATEGORY_DISPLAY: Record<string, string> = {
  coding: "Coding",
  debugging: "Debugging",
  building: "Building",
  "code-reviewing": "Code review",
  "writing-tests": "Writing tests",
};

export function categoryLabel(value: string): string {
  return CATEGORY_DISPLAY[value] ?? value;
}

export async function fetchToday(
  apiUrl: string,
  out: OutputChannel,
): Promise<TodayResponse | null> {
  const token = await readDeviceToken();
  if (!token) return null;

  try {
    const res = await fetch(`${apiUrl}/api/v1/me/today`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      out.appendLine(`[today] HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as TodayResponse;
  } catch (err) {
    out.appendLine(`[today] fetch failed: ${err}`);
    return null;
  }
}

async function readDeviceToken(): Promise<string | null> {
  const home = process.env.INLINR_HOME || path.join(os.homedir(), ".inlinr");
  const read = (name: string) =>
    fs.readFile(path.join(home, name), "utf8").catch(() => null);
  return pickDeviceToken(
    await read("config.toml"),
    await read("claude-code.json"),
  );
}

/** config.toml's token, else the one an older Claude Code plugin saved. */
export function pickDeviceToken(
  configToml: string | null,
  pluginJson: string | null,
): string | null {
  // Match: device_token = "in_d_..." (single or double quoted)
  const m = configToml?.match(/device_token\s*=\s*["']([^"']+)["']/);
  if (m?.[1]) return m[1];
  try {
    const token = JSON.parse(pluginJson ?? "")?.deviceToken;
    return typeof token === "string" && token ? token : null;
  } catch {
    return null;
  }
}

// "1h 23m" / "47m" / "2s" — no leading zeros, no seconds past 1 minute.
export function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  const mins = Math.floor(s / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins === 0 ? `${hours}h` : `${hours}h ${remMins}m`;
}
