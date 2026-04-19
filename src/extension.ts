import * as vscode from "vscode";
import { Tracker } from "./tracker";
import { ensureCli, cliPath, scheduleAutoUpgrade } from "./dependencies";
import { runActivate, runDoctor, openDashboard, revokeDevice } from "./commands";

let tracker: Tracker | undefined;

export async function activate(context: vscode.ExtensionContext) {
	const output = vscode.window.createOutputChannel("Inlinr");
	context.subscriptions.push(output);

	try {
		await ensureCli(context, output);
	} catch (err) {
		output.appendLine(`[boot] CLI download failed: ${err}`);
		vscode.window.showErrorMessage(
			"Inlinr couldn't download its CLI. Run `Inlinr: Doctor` after checking your connection.",
		);
		return;
	}

	tracker = new Tracker(cliPath(context), output);
	context.subscriptions.push(tracker);
	context.subscriptions.push(scheduleAutoUpgrade(context, output));

	context.subscriptions.push(
		vscode.commands.registerCommand("inlinr.signIn", () =>
			runActivate(cliPath(context), output, () => tracker?.refreshStatusBarTotal()),
		),
		vscode.commands.registerCommand("inlinr.signOut", () => revokeDevice(cliPath(context), output)),
		vscode.commands.registerCommand("inlinr.dashboard", () => openDashboard()),
		vscode.commands.registerCommand("inlinr.doctor", () => runDoctor(cliPath(context), output)),
		vscode.commands.registerCommand("inlinr.toggleStatusBar", () => tracker?.toggleStatusBar()),
	);
}

export function deactivate() {
	tracker?.dispose();
}
