// Spawns `inlinr heartbeat` with the primary beat as argv and any extras as a
// JSON array on stdin (via --extra-heartbeats). This pattern is borrowed from
// WakaTime: one process launch per flush, regardless of beat count.

import { spawn } from "node:child_process";
import type { OutputChannel } from "vscode";

export type Beat = {
	entity: string;
	time: number;
	project_git_remote: string;
	branch?: string;
	language?: string;
	category?: string;
	is_write?: boolean;
	lineno?: number;
	cursorpos?: number;
	lines?: number;
	ai_tool?: string;
	editor?: string;
	plugin?: string;
};

export function spawnCli(
	cliPath: string,
	primary: Beat,
	extras: Beat[],
	out: OutputChannel,
): Promise<void> {
	const args = buildArgs(primary);
	if (extras.length > 0) args.push("--extra-heartbeats");

	return new Promise((resolve, reject) => {
		const child = spawn(cliPath, ["heartbeat", ...args], { stdio: ["pipe", "pipe", "pipe"] });
		let stderr = "";
		child.stderr.on("data", (d) => (stderr += d.toString()));
		child.on("error", reject);
		child.on("exit", (code) => {
			if (code === 0) resolve();
			else {
				out.appendLine(`[cli] exit ${code}: ${stderr.trim()}`);
				reject(new Error(`inlinr exited ${code}`));
			}
		});
		if (extras.length > 0) {
			child.stdin.write(JSON.stringify(extras));
		}
		child.stdin.end();
	});
}

function buildArgs(b: Beat): string[] {
	const a: string[] = [
		"--entity", b.entity,
		"--time", String(b.time),
		"--project-git-remote", b.project_git_remote,
	];
	if (b.branch) a.push("--branch", b.branch);
	if (b.language) a.push("--language", b.language);
	if (b.category) a.push("--category", b.category);
	if (b.is_write) a.push("--write");
	if (b.lineno != null) a.push("--lineno", String(b.lineno));
	if (b.cursorpos != null) a.push("--cursorpos", String(b.cursorpos));
	if (b.lines != null) a.push("--lines-in-file", String(b.lines));
	if (b.ai_tool) a.push("--ai-tool", b.ai_tool);
	if (b.editor) a.push("--editor", b.editor);
	if (b.plugin) a.push("--plugin", b.plugin);
	return a;
}
