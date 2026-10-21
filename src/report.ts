// Sends the extension's own failures to Inlinr, where they show in
// Admin → Errors (POST /api/v1/plugin-errors). Before this, a CLI that could
// not be downloaded or started was a line in the "Inlinr" output channel,
// and the user simply stopped being tracked.
//
// Only what the CLI cannot report itself: its download, its launch (missing
// binary, blocked by an antivirus) and an exit 2 (a flag it does not know,
// the release-order mistake). A CLI that ran and failed reports on its own.
//
// Sent: the step, the error message with the home folder replaced by "~"
// (the server blanks every other path), the extension version, the
// operating system and the editor. No token, no file content. Off whenever
// VS Code's telemetry is off. No network, no report.
//
// No `vscode` import: the tracker and the tests pass in what it needs.

import * as os from "node:os";

export const REPORT_URL = "https://inlinr.com/api/v1/plugin-errors";

const RESEND_AFTER_MS = 24 * 60 * 60 * 1000;
const FORGET_AFTER_MS = 7 * RESEND_AFTER_MS;
const STATE_KEY = "inlinr.errorReportsSent";
const TIMEOUT_MS = 3000;

/** The bit of `vscode.Memento` the reporter uses: a map kept across restarts. */
export type Store = {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): Thenable<void>;
};

export type ReporterOptions = {
  enabled: () => boolean;
  store: Store;
  version: string;
  editor: string;
  send?: (body: string) => Promise<unknown>;
  now?: () => number;
};

/**
 * True for errors that say nothing about the extension: the network was
 * down. Node's fetch throws `TypeError: fetch failed` with the socket error
 * as its cause; a spawn or DNS failure carries a system code.
 */
export function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === "AbortError" || err.name === "TimeoutError") return true;
  if (err instanceof TypeError && err.message === "fetch failed") return true;
  const code = (err as { code?: unknown }).code;
  return (
    typeof code === "string" &&
    /^(ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|UND_ERR_)/.test(
      code,
    )
  );
}

/** The home folder becomes "~", in both slash directions. */
export function scrubHome(text: string, home = os.homedir()): string {
  if (home.length < 3) return text;
  return text.split(home).join("~").split(home.replace(/\\/g, "/")).join("~");
}

/** Digits that change between runs (pids, ports) do not make a new error. */
export function signature(context: string, message: string): string {
  return `${context}\n${message.replace(/\d{4,}/g, "#")}`;
}

export type Reporter = (context: string, err: unknown) => void;

export function createReporter(opts: ReporterOptions): Reporter {
  const now = opts.now ?? Date.now;
  const send =
    opts.send ??
    ((body: string) =>
      fetch(REPORT_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }));

  return (context, err) => {
    try {
      if (!opts.enabled() || isNetworkError(err)) return;
      const error = err instanceof Error ? err : new Error(String(err));
      const message = scrubHome(error.message);
      const key = signature(context, message);
      const sent = {
        ...(opts.store.get<Record<string, number>>(STATE_KEY) ?? {}),
      };
      const t = now();
      const last = sent[key];
      if (last !== undefined && t - last < RESEND_AFTER_MS) return;
      sent[key] = t;
      for (const [k, at] of Object.entries(sent)) {
        if (t - at > FORGET_AFTER_MS) delete sent[k];
      }
      void opts.store.update(STATE_KEY, sent);

      const body = JSON.stringify({
        source: "vscode",
        version: `vscode-inlinr/${opts.version}`,
        platform: `${process.platform}-${process.arch}`,
        editor: opts.editor,
        context,
        message,
        stack: error.stack ? scrubHome(error.stack) : null,
      });
      void send(body).catch(() => {});
    } catch {
      // Reporting an error must never cause another one.
    }
  };
}
