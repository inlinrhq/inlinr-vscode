// Event pump → CLI subprocess. No network logic here — the `inlinr` binary
// owns auth, queue, and HTTP.

import * as vscode from "vscode";
import * as path from "path";
import { detectAITool } from "./ai-detect";
import { spawnCli } from "./cli";
import { resolveGitContext, watchWorkspaceChanges } from "./git";
import { categoryLabel, fetchToday, formatSeconds } from "./today";

const HEARTBEAT_THROTTLE_MS = 120_000; // same file → at most 1 beat / 2 min
const SEND_BUFFER_MS = 30_000; // flush buffered beats to CLI every 30s
const STATUS_REFRESH_MS = 60_000; // pull today's total every 60s

type ActivityOpts = {
	isWrite?: boolean;
	category?: "coding" | "debugging" | "building" | "code-reviewing" | "writing-tests";
};

type BufferedBeat = {
	entity: string;
	time: number;
	docUri: vscode.Uri; // resolved to (project_git_remote, branch) at flush time
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

export class Tracker implements vscode.Disposable {
	private lastBeatAt = new Map<string, number>(); // key = entity → ms
	private buffer: BufferedBeat[] = [];
	private lastFlushAt = 0;
	private statusBar: vscode.StatusBarItem;
	private subs: vscode.Disposable[] = [];

	constructor(private cli: string, private out: vscode.OutputChannel) {
		this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
		this.statusBar.text = "$(clock) Inlinr";
		this.statusBar.tooltip = "Today's coding time — click to open dashboard";
		this.statusBar.command = "inlinr.dashboard";
		this.refreshStatusBarVisibility();

		this.subs.push(
			// Document-level edits
			vscode.workspace.onDidChangeTextDocument((e) => this.onActivity(e.document)),
			vscode.workspace.onDidSaveTextDocument((d) => this.onActivity(d, { isWrite: true })),

			// Cursor / scroll / tab activity — signals presence without typing
			vscode.window.onDidChangeTextEditorSelection((e) => this.onActivity(e.textEditor.document)),
			vscode.window.onDidChangeTextEditorVisibleRanges((e) => this.onActivity(e.textEditor.document)),
			vscode.window.onDidChangeActiveTextEditor((e) => e && this.onActivity(e.document)),
			vscode.window.tabGroups.onDidChangeTabs(() => this.onActivityOnActive()),

			// Window focus — user alt-tabs back into VS Code
			vscode.window.onDidChangeWindowState((s) => s.focused && this.onActivityOnActive()),

			// Terminal activity — using the terminal inside VS Code still counts
			vscode.window.onDidOpenTerminal(() => this.onActivityOnActive()),
			vscode.window.onDidChangeActiveTerminal(() => this.onActivityOnActive()),

			// Debug sessions — category "debugging"
			vscode.debug.onDidStartDebugSession(() => this.onActivityOnActive({ category: "debugging" })),
			vscode.debug.onDidTerminateDebugSession(() => this.onActivityOnActive()),

			// Build tasks — category "building"
			vscode.tasks.onDidStartTask(() => this.onActivityOnActive({ category: "building" })),

			// Notebooks (Jupyter)
			vscode.workspace.onDidChangeNotebookDocument((e) => {
				const doc = vscode.window.activeTextEditor?.document;
				if (doc) this.onActivity(doc);
				else void e; // ignore if we can't attach to a document
			}),
			vscode.workspace.onDidSaveNotebookDocument(() => this.onActivityOnActive({ isWrite: true })),
		);
		watchWorkspaceChanges(this.subs);

		setInterval(() => void this.flushIfDue().catch((err) => this.out.appendLine(`[tracker] ${err}`)), 5_000);

		// Kick off status bar refresh loop — first call immediate, then every 60s.
		void this.refreshStatusBarTotal();
		setInterval(() => void this.refreshStatusBarTotal(), STATUS_REFRESH_MS);
	}

	dispose() {
		for (const s of this.subs) s.dispose();
		this.statusBar.dispose();
	}

	toggleStatusBar() {
		const cfg = vscode.workspace.getConfiguration("inlinr");
		const next = !cfg.get<boolean>("statusBarEnabled", true);
		void cfg.update("statusBarEnabled", next, vscode.ConfigurationTarget.Global);
		this.refreshStatusBarVisibility();
	}

	private refreshStatusBarVisibility() {
		const enabled = vscode.workspace.getConfiguration("inlinr").get<boolean>("statusBarEnabled", true);
		if (enabled) this.statusBar.show();
		else this.statusBar.hide();
	}

	async refreshStatusBarTotal() {
		const res = await fetchToday("https://inlinr.com", this.out);
		if (!res) {
			this.statusBar.text = "$(clock) Inlinr - sign in";
			this.statusBar.tooltip = "Click to connect this device";
			this.statusBar.command = "inlinr.signIn";
			return;
		}
		this.statusBar.command = "inlinr.dashboard";
		this.statusBar.text = `$(clock) ${formatSeconds(res.seconds)}`;
		const top = res.top_projects
			.slice(0, 3)
			.map((p) => `- ${p.name} — ${formatSeconds(p.seconds)}`)
			.join("\n");
		const cats = res.by_category
			.slice(0, 5)
			.map((c) => `- ${categoryLabel(c.name)} — ${formatSeconds(c.seconds)}`)
			.join("\n");
		const parts = [
			`**Today on Inlinr**`,
			`${formatSeconds(res.seconds)} coded · ${res.beats} beats`,
		];
		if (top) parts.push(`**Top projects**`, top);
		if (cats) parts.push(`**Activity**`, cats);
		parts.push(`_Click to open dashboard_`);
		this.statusBar.tooltip = new vscode.MarkdownString(parts.join("\n\n"));
	}

	/**
	 * Shortcut for events that don't carry a document (terminal, debug, tasks,
	 * window focus) — uses the currently active editor's document as the target.
	 * No-ops if there's no active editor.
	 */
	private onActivityOnActive(opts: ActivityOpts = {}) {
		const doc = vscode.window.activeTextEditor?.document;
		if (doc) this.onActivity(doc, opts);
	}

	private onActivity(doc: vscode.TextDocument, opts: ActivityOpts = {}) {
		if (doc.uri.scheme !== "file") return;

		const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
		if (!folder) return;

		const isWrite = opts.isWrite ?? false;
		const entity = doc.fileName;
		const now = Date.now();
		const last = this.lastBeatAt.get(entity) ?? 0;
		if (!isWrite && now - last < HEARTBEAT_THROTTLE_MS) return;
		this.lastBeatAt.set(entity, now);

		const beat: BufferedBeat = {
			entity: path.relative(folder.uri.fsPath, entity) || path.basename(entity),
			time: now / 1000,
			docUri: doc.uri,
			language: doc.languageId || undefined,
			category: opts.category ?? "coding",
			is_write: isWrite,
			lineno: (vscode.window.activeTextEditor?.selection.active.line ?? 0) + 1,
			cursorpos: vscode.window.activeTextEditor?.selection.active.character,
			lines: doc.lineCount,
			ai_tool: detectAITool() ?? undefined,
			editor: vscode.env.appName.toLowerCase().includes("cursor") ? "cursor" : "vscode",
			plugin: `vscode-inlinr/${getPackageVersion()}`,
		};

		this.buffer.push(beat);
		if (isWrite) void this.flushIfDue(true).catch((err) => this.out.appendLine(`[tracker] ${err}`));
	}

	private async flushIfDue(force = false) {
		const now = Date.now();
		if (!force && now - this.lastFlushAt < SEND_BUFFER_MS) return;
		if (this.buffer.length === 0) return;

		const pending = this.buffer;
		this.buffer = [];
		this.lastFlushAt = now;

		// Resolve git context once per unique workspace folder (cached inside
		// resolveGitContext). Beats whose folder has no git remote get dropped.
		const resolved = await Promise.all(
			pending.map(async (b) => {
				const ctx = await resolveGitContext(b.docUri);
				if (!ctx.remote) return null;
				return {
					entity: b.entity,
					time: b.time,
					project_git_remote: ctx.remote,
					branch: ctx.branch ?? undefined,
					language: b.language,
					category: b.category,
					is_write: b.is_write,
					lineno: b.lineno,
					cursorpos: b.cursorpos,
					lines: b.lines,
					ai_tool: b.ai_tool,
					editor: b.editor,
					plugin: b.plugin,
				};
			}),
		);

		const withRemote = resolved.filter((b): b is NonNullable<typeof b> => b !== null);
		if (withRemote.length === 0) {
			this.out.appendLine("[tracker] skip: no git remote on any buffered beat");
			return;
		}

		const [primary, ...rest] = withRemote;
		if (!primary) return;

		try {
			await spawnCli(this.cli, primary, rest, this.out);
		} catch (err) {
			this.out.appendLine(`[tracker] cli failed: ${err}`);
		}
	}
}

function getPackageVersion(): string {
	try {
		const ext = vscode.extensions.getExtension("inlinr.inlinr-vscode");
		return ext?.packageJSON?.version ?? "0.0.0";
	} catch {
		return "0.0.0";
	}
}
