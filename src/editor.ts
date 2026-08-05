// Which editor is hosting us, and on which build.
//
// This lives in its own module because it used to live in two: `commands.ts`
// named the fork correctly at activation time, while `tracker.ts` carried an
// inline ternary that only knew about Cursor. Every other fork therefore
// registered its Device as "windsurf" and then sent heartbeats labelled
// "vscode" forever after — an editor breakdown built on beats counted Windsurf
// at zero. One function, called from both, is the fix.

import * as vscode from "vscode";

/**
 * Wire id for the host editor.
 *
 * Cursor, Windsurf and Insiders all run the same extension — we publish one
 * artifact to OpenVSX for exactly that reason — so `plugin` can never tell
 * them apart. This is the only field that does.
 *
 * Values must stay inside the server's editor whitelist
 * (`KNOWN_EDITOR_PREFIXES` in my.inlinr.com `src/routes/api/v1/heartbeats.ts`);
 * an unknown fork is reported as plain "vscode" rather than as a name the
 * server would have to invent a bucket for.
 */
export function editorId(): string {
	const app = vscode.env.appName.toLowerCase();
	if (app.includes("cursor")) return "cursor";
	if (app.includes("windsurf")) return "windsurf";
	if (app.includes("insiders")) return "vscode-insiders";
	return "vscode";
}

/**
 * Version of the host editor.
 *
 * In a fork this is the *embedded VS Code build* (e.g. "1.99.3"), not the
 * fork's own release number: `vscode.version` is the only version the
 * extension API exposes, and neither Cursor nor Windsurf publishes theirs to
 * extensions. Reporting it as "Cursor 1.99.3" would be a confident lie, so the
 * dashboard labels it as the VS Code baseline and nothing more.
 */
export function editorVersion(): string | undefined {
	return vscode.version || undefined;
}
