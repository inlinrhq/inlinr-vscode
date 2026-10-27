// Downloads the `inlinr` CLI binary on first run, and installs it only when
// its signed SHA256SUMS.txt lists it (release-key.ts). Binaries live next to the extension in globalStorage
// so we don't pollute the user's PATH.

import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type * as vscode from "vscode";
import { verifyRelease } from "./release-key";
import type { Reporter } from "./report";

const GITHUB_LATEST =
  "https://github.com/inlinrhq/inlinr-cli/releases/latest/download";
const UPGRADE_INTERVAL_MS = 4 * 60 * 60 * 1000;

export function cliPath(ctx: vscode.ExtensionContext): string {
  const ext = process.platform === "win32" ? ".exe" : "";
  return path.join(ctx.globalStorageUri.fsPath, `inlinr${ext}`);
}

export async function ensureCli(
  ctx: vscode.ExtensionContext,
  out: vscode.OutputChannel,
) {
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

  const [bin, shaFile, sig] = await Promise.all([
    fetchBuf(url),
    fetchBuf(shaUrl),
    fetchBuf(`${shaUrl}.sig`),
  ]);
  verifyRelease(
    bin,
    archiveName + (os === "windows" ? ".exe" : ""),
    shaFile,
    sig,
  );

  // Written beside it, then renamed: a flush spawning the CLI mid-write
  // would run a half-written binary.
  const tmp = `${binPath}.download`;
  await fs.writeFile(tmp, bin, { mode: 0o755 });
  await fs.rename(tmp, binPath);
  out.appendLine(`[boot] CLI installed: ${binPath}`);
}

function platformId(): {
  os: "darwin" | "linux" | "windows";
  arch: "amd64" | "arm64";
} {
  const os =
    process.platform === "darwin"
      ? "darwin"
      : process.platform === "win32"
        ? "windows"
        : "linux";
  const arch = process.arch === "arm64" ? "arm64" : "amd64";
  return { os, arch };
}

async function fetchBuf(url: string): Promise<Buffer> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// Schedules a background `inlinr upgrade` every 4h. The CLI no-ops if already
// on the latest version, so calling unconditionally is safe + cheap. Stdout is
// streamed to the output channel for visibility but we never surface UI.
export function scheduleAutoUpgrade(
  ctx: vscode.ExtensionContext,
  out: vscode.OutputChannel,
  report: Reporter,
): vscode.Disposable {
  const run = () => {
    const child = spawn(cliPath(ctx), ["upgrade"], { stdio: "pipe" });
    child.stdout.on("data", (d) => out.append(`[upgrade] ${d.toString()}`));
    child.stderr.on("data", (d) => out.append(`[upgrade] ${d.toString()}`));
    child.on("error", (err) => {
      out.appendLine(`[upgrade] spawn failed: ${err.message}`);
      report("cli-upgrade", err);
    });
  };
  const handle = setInterval(run, UPGRADE_INTERVAL_MS);
  // Delay the first check so we don't race with a just-finished initial download.
  const firstCheck = setTimeout(run, 60_000);
  return {
    dispose: () => {
      clearInterval(handle);
      clearTimeout(firstCheck);
    },
  };
}

// kept for future: stream-download with pipeline() + progress
void Readable;
void pipeline;
void createWriteStream;
