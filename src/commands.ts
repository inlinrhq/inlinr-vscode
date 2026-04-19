import * as vscode from "vscode";
import { spawn } from "node:child_process";

export async function runActivate(cli: string, out: vscode.OutputChannel) {
	out.show(true);
	out.appendLine("[activate] spawning inlinr activate...");
	const child = spawn(cli, ["activate", "--editor", editorId(), "--no-open"], { stdio: "pipe" });
	child.stdout.on("data", (d) => {
		const text = d.toString();
		out.append(text);
		// Surface the activation URL so the user can open it even if browser auto-open failed
		const m = text.match(/https?:\/\/\S+\/activate\?code=\S+/);
		if (m) {
			vscode.env.openExternal(vscode.Uri.parse(m[0]));
		}
	});
	child.stderr.on("data", (d) => out.append(d.toString()));
	child.on("exit", (code) => {
		if (code === 0) vscode.window.showInformationMessage("Inlinr is activated for this machine.");
		else vscode.window.showErrorMessage(`Inlinr activation failed (exit ${code}).`);
	});
}

export function openDashboard() {
	vscode.env.openExternal(vscode.Uri.parse("https://inlinr.com/dashboard"));
}

export async function runDoctor(cli: string, out: vscode.OutputChannel) {
	out.show(true);
	const child = spawn(cli, ["doctor"], { stdio: "pipe" });
	child.stdout.on("data", (d) => out.append(d.toString()));
	child.stderr.on("data", (d) => out.append(d.toString()));
}

export async function revokeDevice(_cli: string, out: vscode.OutputChannel) {
	// TODO: call POST /api/auth/device/revoke with the current token, then clear it from config.
	out.appendLine("[signOut] not implemented yet — delete ~/.inlinr/config.toml manually for now.");
	vscode.window.showWarningMessage(
		"Sign out isn't wired up yet. Delete ~/.inlinr/config.toml manually for now.",
	);
}

function editorId(): string {
	const app = vscode.env.appName.toLowerCase();
	if (app.includes("cursor")) return "cursor";
	if (app.includes("windsurf")) return "windsurf";
	if (app.includes("insiders")) return "vscode-insiders";
	return "vscode";
}
