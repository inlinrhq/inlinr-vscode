import * as vscode from "vscode";
import { spawn } from "node:child_process";

export async function runActivate(
	cli: string,
	out: vscode.OutputChannel,
	onActivated?: () => void | Promise<void>,
) {
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
		if (code === 0) {
			vscode.window.showInformationMessage("Inlinr is activated for this machine.");
			void onActivated?.();
		} else {
			vscode.window.showErrorMessage(`Inlinr activation failed (exit ${code}).`);
		}
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

export async function revokeDevice(cli: string, out: vscode.OutputChannel) {
	const confirm = await vscode.window.showWarningMessage(
		"Sign out of Inlinr on this machine? Your local token will be revoked server-side and cleared.",
		{ modal: true },
		"Sign out",
	);
	if (confirm !== "Sign out") return;

	out.show(true);
	out.appendLine("[signOut] spawning inlinr signout...");
	const child = spawn(cli, ["signout"], { stdio: "pipe" });
	child.stdout.on("data", (d) => out.append(d.toString()));
	child.stderr.on("data", (d) => out.append(d.toString()));
	child.on("exit", (code) => {
		if (code === 0) {
			vscode.window.showInformationMessage("Signed out of Inlinr on this machine.");
		} else {
			vscode.window.showErrorMessage(`Inlinr sign out failed (exit ${code}). See Output.`);
		}
	});
}

function editorId(): string {
	const app = vscode.env.appName.toLowerCase();
	if (app.includes("cursor")) return "cursor";
	if (app.includes("windsurf")) return "windsurf";
	if (app.includes("insiders")) return "vscode-insiders";
	return "vscode";
}
