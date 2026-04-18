// Detects which AI coding assistant (if any) is currently "live" in the editor.
// Priority order: recent chat activity > installed extension with recent use >
// installed extension. Returns the server-side enum value (snake_case mapping
// happens on the server).

import * as vscode from "vscode";

// Extension IDs that signal a specific AI tool is present. Keep in sync with
// the `AiTool` enum on the server.
const EXTENSION_MAP: Array<{ id: string; tool: string }> = [
	{ id: "github.copilot",            tool: "copilot" },
	{ id: "github.copilot-chat",       tool: "copilot" },
	{ id: "anysphere.cursor",          tool: "cursor" },
	{ id: "anthropic.claude-code",     tool: "claude-code" },
	{ id: "codeium.codeium",           tool: "codeium" },
	{ id: "exafunction.windsurf",      tool: "windsurf" },
	{ id: "codeium.windsurf-pyright",  tool: "windsurf" },
];

// Detect from running app name first (Cursor is a VS Code fork — it always
// reports itself as cursor regardless of what's installed).
export function detectAITool(): string | null {
	const app = vscode.env.appName.toLowerCase();
	if (app.includes("cursor")) return "cursor";
	if (app.includes("windsurf")) return "windsurf";

	for (const { id, tool } of EXTENSION_MAP) {
		const ext = vscode.extensions.getExtension(id);
		if (ext?.isActive) return tool;
	}
	return null;
}
