// Downloads and verifies the `inlinr` CLI binary on first run (and when a new
// version is available). Binaries live next to the extension in globalStorage
// so we don't pollute the user's PATH.

import * as vscode from "vscode";
import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const GITHUB_LATEST = "https://github.com/inlinrhq/inlinr-cli/releases/latest/download";
const UPGRADE_INTERVAL_MS = 4 * 60 * 60 * 1000;

export function cliPath(ctx: vscode.ExtensionContext): string {
	const ext = process.platform === "win32" ? ".exe" : "";
	return path.join(ctx.globalStorageUri.fsPath, "inlinr" + ext);
}

export async function ensureCli(ctx: vscode.ExtensionContext, out: vscode.OutputChannel) {
	const binPath = cliPath(ctx);
	try {
		await fs.access(binPath);
		return;
	} catch {
		// fallthrough — needs download
	}

	const { os, arch } = platformId();
	const archiveName = `inlinr-${os}-${arch}`;
	const url = `${GITHUB_LATEST}/${archiveName}${os === "windows" ? ".exe" : ""}`;
	const shaUrl = `${GITHUB_LATEST}/SHA256SUMS.txt`;

	await fs.mkdir(path.dirname(binPath), { recursive: true });
	out.appendLine(`[boot] downloading CLI: ${url}`);

	const [bin, shaFile] = await Promise.all([fetchBuf(url), fetchBuf(shaUrl)]);

	const expected = parseSha(shaFile.toString(), archiveName + (os === "windows" ? ".exe" : ""));
	const actual = crypto.createHash("sha256").update(bin).digest("hex");
	if (expected && expected !== actual) {
		throw new Error(`SHA256 mismatch: expected ${expected}, got ${actual}`);
	}

	await fs.writeFile(binPath, bin, { mode: 0o755 });
	out.appendLine(`[boot] CLI installed: ${binPath}`);
}

function platformId(): { os: "darwin" | "linux" | "windows"; arch: "amd64" | "arm64" } {
	const os =
		process.platform === "darwin" ? "darwin" :
		process.platform === "win32"  ? "windows" :
		"linux";
	const arch = process.arch === "arm64" ? "arm64" : "amd64";
	return { os, arch };
}

async function fetchBuf(url: string): Promise<Buffer> {
	const res = await fetch(url, { redirect: "follow" });
	if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
	return Buffer.from(await res.arrayBuffer());
}

function parseSha(manifest: string, name: string): string | null {
	for (const line of manifest.split(/\r?\n/)) {
		const [sha, file] = line.trim().split(/\s+/);
		if (file === name) return sha ?? null;
	}
	return null;
}

// Schedules a background `inlinr upgrade` every 4h. The CLI no-ops if already
// on the latest version, so calling unconditionally is safe + cheap. Stdout is
// streamed to the output channel for visibility but we never surface UI.
export function scheduleAutoUpgrade(
	ctx: vscode.ExtensionContext,
	out: vscode.OutputChannel,
): vscode.Disposable {
	const run = () => {
		const child = spawn(cliPath(ctx), ["upgrade"], { stdio: "pipe" });
		child.stdout.on("data", (d) => out.append(`[upgrade] ${d.toString()}`));
		child.stderr.on("data", (d) => out.append(`[upgrade] ${d.toString()}`));
		child.on("error", (err) => out.appendLine(`[upgrade] spawn failed: ${err.message}`));
	};
	const handle = setInterval(run, UPGRADE_INTERVAL_MS);
	// Delay the first check so we don't race with a just-finished initial download.
	const firstCheck = setTimeout(run, 60_000);
	return { dispose: () => { clearInterval(handle); clearTimeout(firstCheck); } };
}

// kept for future: stream-download with pipeline() + progress
void Readable;
void pipeline;
void createWriteStream;
