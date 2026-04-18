// Downloads and verifies the `inlinr` CLI binary on first run (and when a new
// version is available). Binaries live next to the extension in globalStorage
// so we don't pollute the user's PATH.

import * as vscode from "vscode";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const GITHUB_LATEST = "https://github.com/inlinrhq/inlinr-cli/releases/latest/download";

export function cliPath(ctx: vscode.ExtensionContext): string {
	const ext = process.platform === "win32" ? ".exe" : "";
	return path.join(ctx.globalStorageUri.fsPath, "inlinr" + ext);
}

export async function ensureCli(ctx: vscode.ExtensionContext, out: vscode.OutputChannel) {
	const binPath = cliPath(ctx);
	try {
		await fs.access(binPath);
		return; // TODO: version check every 4h, auto-upgrade
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

// kept for future: stream-download with pipeline() + progress
void Readable;
void pipeline;
void createWriteStream;
