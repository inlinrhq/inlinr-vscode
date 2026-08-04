// Names the AI assistant behind an edit — *once we know an AI edit happened*.
//
// The old version returned a tool as soon as its extension was installed and
// active. Copilot activates at startup whether you use it or not, so every beat
// reported `copilot` and no other assistant was ever seen. Cursor and Windsurf
// had the same problem from the other direction: running in the fork forced
// `aiTool`, so typing by hand in Cursor still counted as AI-written.
//
// Split in two:
//   - `installedAiTool()` answers "which assistant is available here?"
//   - `detectAITool(evidence)` answers "which assistant wrote this?", and
//     returns null unless `edit-attribution.ts` actually saw generated code.
//
// Result: `editor` and `aiTool` are now independent. `editor=cursor,
// aiTool=null` is a valid, common beat — a person typing in Cursor.

import * as vscode from "vscode";

// Extension IDs that signal a specific AI tool is present. Keep in sync with
// the `AiTool` enum on the server.
const EXTENSION_MAP: Array<{ id: string; tool: string }> = [
	{ id: "github.copilot", tool: "copilot" },
	{ id: "github.copilot-chat", tool: "copilot" },
	{ id: "anysphere.cursor", tool: "cursor" },
	{ id: "anthropic.claude-code", tool: "claude-code" },
	{ id: "codeium.codeium", tool: "codeium" },
	{ id: "exafunction.windsurf", tool: "windsurf" },
	{ id: "codeium.windsurf-pyright", tool: "windsurf" },
];

/**
 * Which assistant is *available* in this window. Presence only — says nothing
 * about whether it wrote anything.
 */
export function installedAiTool(): string | null {
	const app = vscode.env.appName.toLowerCase();
	// Cursor and Windsurf are VS Code forks with the assistant built in, so
	// there is no extension to look for.
	if (app.includes("cursor")) return "cursor";
	if (app.includes("windsurf")) return "windsurf";

	for (const { id, tool } of EXTENSION_MAP) {
		const ext = vscode.extensions.getExtension(id);
		if (ext?.isActive) return tool;
	}
	return null;
}

export type AiEvidence = {
	/** Set by `EditAccumulator` when a change in this window looked generated. */
	sawAiEdit: boolean;
};

/**
 * The assistant to attribute this beat to, or null.
 *
 * Null in two different situations, both correct:
 *   - no generated edit in this window (the common case — a person typing);
 *   - a generated edit, but nothing installed that we can name. We still report
 *     the AI line counts on the beat; we just don't invent a tool name.
 */
export function detectAITool(evidence: AiEvidence): string | null {
	if (!evidence.sawAiEdit) return null;
	return installedAiTool();
}
