// Event pump → CLI subprocess. No network logic here — the `inlinr` binary
// owns auth, queue, and HTTP.

import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { detectAITool } from "./ai-detect";
import { CliExitError, spawnCli } from "./cli";
import { EditAccumulator } from "./edit-attribution";
import { editorId, editorVersion } from "./editor";
import { folderProjectName } from "./folder-project";
import { resolveGitContext, watchWorkspaceChanges } from "./git";
import type { Reporter } from "./report";
import { categoryLabel, fetchToday, formatSeconds } from "./today";

const HEARTBEAT_THROTTLE_MS = 120_000; // same file → at most 1 beat / 2 min
const SEND_BUFFER_MS = 30_000; // flush buffered beats to CLI every 30s
const STATUS_REFRESH_MS = 60_000; // pull today's total every 60s

type ActivityOpts = {
  isWrite?: boolean;
  category?:
    | "coding"
    | "debugging"
    | "building"
    | "code-reviewing"
    | "writing-tests";
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
  lines_added?: number;
  lines_deleted?: number;
  ai_lines_added?: number;
  ai_lines_deleted?: number;
  editor?: string;
  editor_version?: string;
  plugin?: string;
};

// The clipboard read is async and we need the answer synchronously inside the
// change handler, so we keep a short-lived copy. A stale clipboard only costs
// us one misclassified paste, which is the cheap direction to be wrong in.
const CLIPBOARD_REFRESH_MS = 2_000;

// Beats kept for a CLI that keeps failing (a missing binary, an antivirus
// lock): about a day of steady work. Past that the oldest go first.
const MAX_BUFFERED = 2_000;

export class Tracker implements vscode.Disposable {
  private lastBeatAt = new Map<string, number>(); // key = entity → ms
  private buffer: BufferedBeat[] = [];
  private lastFlushAt = 0;
  private flushing: Promise<void> | null = null;
  private timers: ReturnType<typeof setInterval>[] = [];
  private statusBar: vscode.StatusBarItem;
  private subs: vscode.Disposable[] = [];
  private edits = new EditAccumulator();
  private clipboard: string | null = null;
  private clipboardReadAt = 0;

  constructor(
    private cli: string,
    private out: vscode.OutputChannel,
    private report: Reporter,
  ) {
    this.statusBar = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100,
    );
    this.statusBar.text = "$(clock) inlinr";
    this.statusBar.tooltip = "Today's coding time — click to open dashboard";
    this.statusBar.command = "inlinr.dashboard";
    this.refreshStatusBarVisibility();

    this.subs.push(
      // Document-level edits. Attribution happens here, on the raw change
      // event — by flush time the shape of the edit is long gone.
      vscode.workspace.onDidChangeTextDocument((e) => {
        this.onDocumentChange(e);
        this.onActivity(e.document);
      }),
      vscode.workspace.onDidSaveTextDocument((d) =>
        this.onActivity(d, { isWrite: true }),
      ),

      // Cursor / scroll / tab activity — signals presence without typing
      vscode.window.onDidChangeTextEditorSelection((e) =>
        this.onActivity(e.textEditor.document),
      ),
      vscode.window.onDidChangeTextEditorVisibleRanges((e) =>
        this.onActivity(e.textEditor.document),
      ),
      vscode.window.onDidChangeActiveTextEditor(
        (e) => e && this.onActivity(e.document),
      ),
      vscode.window.tabGroups.onDidChangeTabs(() => this.onActivityOnActive()),

      // Window focus — user alt-tabs back into VS Code
      vscode.window.onDidChangeWindowState(
        (s) => s.focused && this.onActivityOnActive(),
      ),

      // Terminal activity — using the terminal inside VS Code still counts
      vscode.window.onDidOpenTerminal(() => this.onActivityOnActive()),
      vscode.window.onDidChangeActiveTerminal(() => this.onActivityOnActive()),

      // Debug sessions — category "debugging"
      vscode.debug.onDidStartDebugSession(() =>
        this.onActivityOnActive({ category: "debugging" }),
      ),
      vscode.debug.onDidTerminateDebugSession(() => this.onActivityOnActive()),

      // Build tasks — category "building"
      vscode.tasks.onDidStartTask(() =>
        this.onActivityOnActive({ category: "building" }),
      ),

      // Notebooks (Jupyter)
      vscode.workspace.onDidChangeNotebookDocument((e) => {
        const doc = vscode.window.activeTextEditor?.document;
        if (doc) this.onActivity(doc);
        else void e; // ignore if we can't attach to a document
      }),
      vscode.workspace.onDidSaveNotebookDocument(() =>
        this.onActivityOnActive({ isWrite: true }),
      ),
    );
    watchWorkspaceChanges(this.subs);

    this.timers.push(
      setInterval(
        () => void this.flushIfDue().catch((err) => this.flushFailed(err)),
        5_000,
      ),
    );

    // Kick off status bar refresh loop — first call immediate, then every 60s.
    void this.refreshStatusBarTotal();
    this.timers.push(
      setInterval(() => void this.refreshStatusBarTotal(), STATUS_REFRESH_MS),
    );
  }

  dispose() {
    for (const t of this.timers) clearInterval(t);
    for (const s of this.subs) s.dispose();
    this.statusBar.dispose();
  }

  toggleStatusBar() {
    const cfg = vscode.workspace.getConfiguration("inlinr");
    const next = !cfg.get<boolean>("statusBarEnabled", true);
    void cfg.update(
      "statusBarEnabled",
      next,
      vscode.ConfigurationTarget.Global,
    );
    this.refreshStatusBarVisibility();
  }

  private refreshStatusBarVisibility() {
    const enabled = vscode.workspace
      .getConfiguration("inlinr")
      .get<boolean>("statusBarEnabled", true);
    if (enabled) this.statusBar.show();
    else this.statusBar.hide();
  }

  async refreshStatusBarTotal() {
    const res = await fetchToday("https://inlinr.com", this.out);
    if (!res) {
      this.statusBar.text = "$(clock) inlinr - sign in";
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
      `**Today on inlinr**`,
      `${formatSeconds(res.seconds)} coded · ${res.beats} beats`,
    ];
    if (top) parts.push(`**Top projects**`, top);
    if (cats) parts.push(`**Activity**`, cats);
    parts.push(`_Click to open dashboard_`);
    this.statusBar.tooltip = new vscode.MarkdownString(parts.join("\n\n"));
  }

  /**
   * Classify every document change as human- or AI-authored and bank the line
   * counts against the file, to be drained onto the next heartbeat.
   */
  private onDocumentChange(e: vscode.TextDocumentChangeEvent) {
    if (e.document.uri.scheme !== "file") return;
    if (e.contentChanges.length === 0) return;
    void this.refreshClipboard();

    this.edits.record(e.document.fileName, {
      changes: e.contentChanges.map((c) => ({
        insertedText: c.text,
        removedLineCount: c.range.end.line - c.range.start.line,
        removedCharCount: c.rangeLength,
      })),
      isUndoRedo:
        e.reason === vscode.TextDocumentChangeReason.Undo ||
        e.reason === vscode.TextDocumentChangeReason.Redo,
      clipboard: this.clipboard,
    });
  }

  /**
   * A flush that threw before the CLI ran (resolving a project, building
   * the beats): the extension's own code, which only the output channel
   * used to see, while beats waited in memory. The CLI's failures are
   * handled inside the flush.
   */
  private flushFailed(err: unknown) {
    this.out.appendLine(`[tracker] ${err}`);
    this.report("flush", err);
  }

  /** Throttled clipboard snapshot — see CLIPBOARD_REFRESH_MS. */
  private async refreshClipboard() {
    const now = Date.now();
    if (now - this.clipboardReadAt < CLIPBOARD_REFRESH_MS) return;
    this.clipboardReadAt = now;
    try {
      this.clipboard = await vscode.env.clipboard.readText();
    } catch {
      this.clipboard = null;
    }
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

    // Drain the edits banked since this file's last beat, so each beat
    // carries the work done in its own window rather than a running total.
    const edits = this.edits.drain(entity);

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
      ai_tool: detectAITool(edits) ?? undefined,
      lines_added: edits.linesAdded,
      lines_deleted: edits.linesDeleted,
      ai_lines_added: edits.aiLinesAdded,
      ai_lines_deleted: edits.aiLinesDeleted,
      editor: editorId(),
      editor_version: editorVersion(),
      plugin: `vscode-inlinr/${getPackageVersion()}`,
    };

    this.buffer.push(beat);
    if (isWrite)
      void this.flushIfDue(true).catch((err) => this.flushFailed(err));
  }

  /**
   * Send whatever is buffered now: VS Code is closing, and beats left in
   * memory would be gone with it.
   */
  async flushNow(): Promise<void> {
    await this.flushing;
    await this.flushIfDue(true);
  }

  private async flushIfDue(force = false) {
    // One CLI at a time: a second flush would send beats the first may yet
    // put back.
    if (this.flushing) return;
    const now = Date.now();
    if (!force && now - this.lastFlushAt < SEND_BUFFER_MS) return;
    if (this.buffer.length === 0) return;
    this.lastFlushAt = now;
    this.flushing = this.flush().finally(() => {
      this.flushing = null;
    });
    await this.flushing;
  }

  private async flush() {
    const pending = this.buffer;
    this.buffer = [];

    // Resolve git context once per unique workspace folder (cached inside
    // resolveGitContext). A folder with no git remote is sent by its name
    // (folder-project.ts), unless the setting says not to.
    const byName = vscode.workspace
      .getConfiguration("inlinr")
      .get<boolean>("trackFoldersWithoutGit", true);
    // Once per folder and flush: it lists the folder's children.
    const names = new Map<string, string | null>();
    const folderName = (fsPath: string) => {
      if (!names.has(fsPath)) {
        names.set(fsPath, folderProjectName(fsPath, os.homedir()));
      }
      return names.get(fsPath) ?? null;
    };
    const resolved = await Promise.all(
      pending.map(async (b) => {
        const ctx = await resolveGitContext(b.docUri);
        const folder = vscode.workspace.getWorkspaceFolder(b.docUri);
        const project =
          !ctx.remote && byName && folder
            ? folderName(folder.uri.fsPath)
            : null;
        if (!ctx.remote && !project) return null;
        return {
          entity: b.entity,
          time: b.time,
          project_git_remote: ctx.remote ?? undefined,
          project: project ?? undefined,
          branch: ctx.branch ?? undefined,
          language: b.language,
          category: b.category,
          is_write: b.is_write,
          lineno: b.lineno,
          cursorpos: b.cursorpos,
          lines: b.lines,
          ai_tool: b.ai_tool,
          lines_added: b.lines_added,
          lines_deleted: b.lines_deleted,
          ai_lines_added: b.ai_lines_added,
          ai_lines_deleted: b.ai_lines_deleted,
          editor: b.editor,
          editor_version: b.editor_version,
          plugin: b.plugin,
        };
      }),
    );

    const sendable = resolved.filter(
      (b): b is NonNullable<typeof b> => b !== null,
    );
    if (sendable.length === 0) {
      this.out.appendLine("[tracker] skip: no project on any buffered beat");
      return;
    }

    // A beat with a remote goes first when there is one: a CLI older than
    // `--project` refuses a primary beat without a remote, and would take the
    // whole flush down with it until it upgrades.
    sendable.sort(
      (a, b) => Number(!a.project_git_remote) - Number(!b.project_git_remote),
    );
    const [primary, ...rest] = sendable;
    if (!primary) return;

    try {
      await spawnCli(this.cli, primary, rest, this.out);
    } catch (err) {
      // Back in the buffer for the next flush: the server stores a beat
      // sent twice only once, so a CLI that had queued them before failing
      // costs nothing.
      const kept = pending.filter((_, i) => resolved[i] !== null);
      this.buffer = [...kept, ...this.buffer].slice(-MAX_BUFFERED);
      this.out.appendLine(
        `[tracker] cli failed, ${kept.length} beats kept for the next try: ${err}`,
      );
      // Exit 1 is the CLI's own failure, which it reports itself.
      if (!(err instanceof CliExitError && err.exitCode === 1)) {
        this.report("heartbeat", err);
      }
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
