import * as vscode from "vscode";
import {
  openDashboard,
  revokeDevice,
  runActivate,
  runDoctor,
} from "./commands";
import { cliPath, ensureCli, scheduleAutoUpgrade } from "./dependencies";
import { editorId } from "./editor";
import { createReporter } from "./report";
import { Tracker } from "./tracker";

let tracker: Tracker | undefined;

export async function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel("Inlinr");
  context.subscriptions.push(output);
  // Failures the CLI cannot report itself, sent only while VS Code's
  // telemetry is on and never from a development host.
  const report = createReporter({
    enabled: () =>
      vscode.env.isTelemetryEnabled &&
      context.extensionMode === vscode.ExtensionMode.Production,
    store: context.globalState,
    version: context.extension.packageJSON.version ?? "0.0.0",
    editor: editorId(),
  });

  try {
    await ensureCli(context, output);
  } catch (err) {
    output.appendLine(`[boot] CLI download failed: ${err}`);
    report("cli-download", err);
    vscode.window.showErrorMessage(
      "Inlinr couldn't download its CLI. Run `Inlinr: Doctor` after checking your connection.",
    );
    return;
  }

  tracker = new Tracker(cliPath(context), output, report);
  context.subscriptions.push(tracker);
  context.subscriptions.push(scheduleAutoUpgrade(context, output, report));

  context.subscriptions.push(
    vscode.commands.registerCommand("inlinr.signIn", () =>
      runActivate(cliPath(context), output, () =>
        tracker?.refreshStatusBarTotal(),
      ),
    ),
    vscode.commands.registerCommand("inlinr.signOut", () =>
      revokeDevice(cliPath(context), output),
    ),
    vscode.commands.registerCommand("inlinr.dashboard", () => openDashboard()),
    vscode.commands.registerCommand("inlinr.doctor", () =>
      runDoctor(cliPath(context), output),
    ),
    vscode.commands.registerCommand("inlinr.toggleStatusBar", () =>
      tracker?.toggleStatusBar(),
    ),
  );
}

// VS Code waits a few seconds for this promise when it closes: long enough
// for one CLI run, so the last beats are not left in memory.
export async function deactivate(): Promise<void> {
  const t = tracker;
  if (!t) return;
  await Promise.race([
    t.flushNow().catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, 4_000)),
  ]);
  t.dispose();
}
