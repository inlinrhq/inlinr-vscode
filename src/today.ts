// Polls GET /api/v1/me/today and formats the result for the status bar.
//
// Reads the device token from the CLI's config file (~/.inlinr/config.toml).
// We don't re-implement TOML parsing — just grep the key we need. If config
// is missing or unparseable we return null and the status bar shows a hint.

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
	try {
		const text = await fs.readFile(path.join(home, "config.toml"), "utf8");
		// Match: device_token = "in_d_..." (single or double quoted)
		const m = text.match(/device_token\s*=\s*["']([^"']+)["']/);
		return m?.[1] ?? null;
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
