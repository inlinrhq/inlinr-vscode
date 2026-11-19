import { spawn } from "node:child_process";
import * as vscode from "vscode";
import { editorId } from "./editor";
import { PAUSE_CHOICES } from "./pause";

export async function runActivate(
  cli: string,
  out: vscode.OutputChannel,
  onActivated?: () => void | Promise<void>,
) {
  out.show(true);
  out.appendLine("[activate] spawning inlinr activate...");
  const child = spawn(cli, ["activate", "--editor", editorId(), "--no-open"], {
    stdio: "pipe",
  });
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
      vscode.window.showInformationMessage(
        "inlinr is activated for this machine, for every inlinr plugin on it.",
      );
      void onActivated?.();
    } else {
      vscode.window.showErrorMessage(
        `inlinr activation failed (exit ${code}).`,
      );
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
    "Sign out of inlinr on this machine? The token is revoked and cleared. Every inlinr plugin on this machine shares it, so the Claude Code plugin stops tracking too. To stop only this editor, turn off the inlinr.enabled setting instead.",
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
      vscode.window.showInformationMessage(
        "Signed out of inlinr on this machine.",
      );
    } else {
      vscode.window.showErrorMessage(
        `inlinr sign out failed (exit ${code}). See Output.`,
      );
    }
  });
}

/**
 * Pause tracking on the whole machine: `inlinr pause`, which the Claude Code
 * plugin follows too. Nothing done during a pause is sent, then or later.
 */
export async function pauseTracking(
  cli: string,
  out: vscode.OutputChannel,
  onDone: () => void | Promise<void>,
) {
  const choice = await vscode.window.showQuickPick(
    PAUSE_CHOICES.map((c) => ({ label: c.label, for: c.for })),
    {
      title: "Pause inlinr on this machine",
      placeHolder:
        "Nothing is tracked or sent meanwhile, from this editor or the Claude Code plugin",
    },
  );
  if (!choice) return;
  const args = choice.for ? ["pause", "--for", choice.for] : ["pause"];
  await runPauseCommand(cli, out, args, onDone);
}

/** End a pause, timed or not: `inlinr resume`. */
export async function resumeTracking(
  cli: string,
  out: vscode.OutputChannel,
  onDone: () => void | Promise<void>,
) {
  await runPauseCommand(cli, out, ["resume"], onDone);
}

function runPauseCommand(
  cli: string,
  out: vscode.OutputChannel,
  args: string[],
  onDone: () => void | Promise<void>,
): Promise<void> {
  return new Promise((resolve) => {
    const child = spawn(cli, args, { stdio: "pipe" });
    let said = "";
    child.stdout.on("data", (d) => {
      said += d.toString();
    });
    child.stderr.on("data", (d) => out.append(d.toString()));
    child.on("error", (err) => {
      out.appendLine(`[${args[0]}] ${err}`);
      vscode.window.showErrorMessage(
        `inlinr ${args[0]} failed: ${err.message}`,
      );
      resolve();
    });
    child.on("exit", (code) => {
      if (code === 0) {
        vscode.window.showInformationMessage(said.trim() || "Done.");
        void onDone();
      } else if (code === 2) {
        // A CLI from before pause existed: it knows no such command, and
        // the auto-upgrade brings the one that does.
        vscode.window.showErrorMessage(
          "This inlinr CLI is too old to pause. It updates itself within a minute of VS Code starting; try again then, or run `inlinr upgrade`.",
        );
      } else {
        vscode.window.showErrorMessage(
          `inlinr ${args[0]} failed (exit ${code}). See Output.`,
        );
      }
      resolve();
    });
  });
}
