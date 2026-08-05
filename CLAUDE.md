# inlinr-vscode

> **Reprise de session** — lis d'abord `../PROGRESS.md` (racine du workspace) : il tient l'état
> d'avancement du chantier en cours, la prochaine action, et couvre les 3 repos. Mets-le à jour
> après chaque modification.

VS Code (and Cursor / Windsurf / other forks) extension for Inlinr.

Thin event pump: editor events → buffer → spawn `inlinr heartbeat`. The CLI owns all auth + network. No network code here.

Sibling repos:
- `inlinrhq/inlinr-cli` — the binary this extension spawns. The CLI arg spec must stay in sync.
- `inlinrhq/my.inlinr.com` — server, owns the heartbeat wire format + Device flow.

## Tech

- TypeScript strict
- esbuild for bundling (no webpack)
- vitest for unit tests
- `@vscode/vsce` for packaging + marketplace publishing

## Layout

```
src/
  extension.ts       # activate() — registers commands + tracker
  tracker.ts        # event listeners, throttle, buffer, flush
  cli.ts            # spawn inlinr with flags + stdin JSON for extras
  editor.ts         # which fork hosts us, and on which VS Code build
  ai-detect.ts      # names the assistant, only when an AI edit was observed
  edit-attribution.ts # human vs AI classification + per-file line counters
  git-fs.ts         # reads .git directly (worktree fallback), no vscode import
  dependencies.ts   # CLI download + SHA256 verify
  commands.ts       # signIn / signOut / dashboard / doctor handlers
```

## Key constants

- `HEARTBEAT_THROTTLE_MS = 120_000` — same file → at most 1 beat / 2 min (matches CLI `heartbeat_rate_limit_seconds`).
- `SEND_BUFFER_MS = 30_000` — flush buffered beats to CLI every 30 s.
- These match WakaTime's defaults; change only with a matching server-side test.

## First-run binary download

`dependencies.ensureCli` fetches `inlinr-{os}-{arch}{.exe}` from
`github.com/inlinrhq/inlinr-cli/releases/latest/download/`, verifies the SHA256 against
the manifest, and writes to `ctx.globalStorageUri`.

`dependencies.scheduleAutoUpgrade` then keeps it current: it spawns
`inlinr upgrade` **60 s after activation** and every 4 h after that. The CLI
no-ops when already on the latest version, so calling unconditionally is cheap.
Failures are logged to the output channel and never surfaced as UI.

That 60-second first check is what makes the release rule below survivable —
it is the window during which a freshly-updated extension can still be talking
to the previous CLI.

## AI tool detection

**Presence is not usage.** `detectAITool()` names a tool only when
`edit-attribution.ts` saw a generated edit in the current window. Copilot
activates at VS Code startup whether or not you use it, so the old
"installed-and-active" rule marked every beat `copilot` and never detected
anything else.

- `edit-attribution.ts` classifies each `onDidChangeTextDocument`: one atomic
  insert of ≥2 lines or ≥80 chars that isn't the clipboard → AI; anything else
  (single chars, deletions, multi-cursor, format-on-save, undo/redo) → human.
  Conservative on purpose — over-reporting AI would flatter the headline number.
- `installedAiTool()` only *names* the tool once that evidence exists.
- `editor` and `aiTool` are independent: `editor=cursor, aiTool=null` is a
  normal beat (a person typing in Cursor).

The mapped value is the wire enum: `copilot` · `cursor` · `claude-code` · `codeium` · `windsurf` · `aider`.

Token counts are **not** the extension's job — see `inlinr sync-ai` in the CLI.

## Editor identification

Cursor, Windsurf and Insiders run **this exact extension** — we publish to
OpenVSX for that reason — so `plugin` is `vscode-inlinr/<v>` in all of them and
can never tell them apart. `editor` is the only field that can, and it comes
from `vscode.env.appName`.

Both the activation path (`Device.editor`) and the heartbeat path
(`Heartbeat.editor`) call **`editorId()` from `editor.ts`**. They used to each
have their own copy, and the copies drifted: the heartbeat one only knew about
Cursor, so a Windsurf user registered a device as `windsurf` and then sent beats
labelled `vscode` forever after. Any editor breakdown built on beats counted
Windsurf at zero. Never re-inline this check.

`editorVersion()` returns `vscode.version`, which inside a fork is the
**embedded VS Code build**, not the fork's release — Cursor and Windsurf don't
publish theirs to extensions. Report it as a VS Code baseline; labelling it
"Cursor 1.99.3" would be wrong.

## Commands

```
Inlinr: Sign in            # spawn `inlinr activate --editor <id>`
Inlinr: Sign out           # TODO — revoke device token
Inlinr: Open dashboard     # browser → https://inlinr.com/dashboard
Inlinr: Doctor             # spawn `inlinr doctor`
Inlinr: Toggle status bar  # hide/show the clock item
```

## What's missing / TODO

This list previously named four items — git remote resolution, sign out, status
bar time, CLI auto-upgrade — that had all been built. A TODO list describing
finished work is worse than no list: it sends the next reader off to implement
something twice. Delete entries here when they ship.

- **Beats are dropped when the CLI fails.** `tracker.flushIfDue` clears
  `this.buffer` *before* spawning the CLI and only logs on failure, so anything
  in flight during a CLI error is gone — it is not requeued. Tolerable while
  failures are rare, and the direct cause of the release-order rule below.
- **Nothing is code-signed.** Same as `inlinr-cli`: the release workflow
  packages and publishes, it does not sign. Said plainly because this file used
  to claim the workflow signed the `.vsix`, and it never has.
- **No `LICENSE` file** even though `package.json` declares `BSD-3-Clause` and
  the README says BSD-3. `vsce` warns on every release.

## Marketplaces

- VS Code Marketplace: `vsce publish` (publisher: `inlinr`).
- OpenVSX: `ovsx publish` — required for Cursor + Windsurf users (they don't have Marketplace access).
- Release workflow: tag `vX.Y.Z` → GitHub Actions packages the `.vsix` and uploads it to both marketplaces + the GitHub Release. **No signing step exists.**
- Both marketplaces index asynchronously: a green workflow means the package was
  accepted, not that the new version is being served yet. Query
  `open-vsx.org/api/inlinr/inlinr-vscode` and the Marketplace `extensionquery`
  API before claiming a release is live.

### Release order — CLI first, always

When a change adds a **new CLI flag**, `inlinr-cli` must be released *before*
this extension. `cmd/inlinr/heartbeat.go` builds its FlagSet with
`flag.ExitOnError`, so an unrecognised flag makes the binary exit 2 immediately;
combined with the dropped-beats behaviour above, an extension that reaches an
older CLI loses every beat it was flushing until the auto-upgrade catches up.

Shipping the other way round is silent — nothing errors in CI, users just lose
tracked time.

---

## Contract (sync with `inlinrhq/inlinr-cli` + `inlinrhq/my.inlinr.com`)

### CLI invocation (this repo → `inlinr` binary)

```sh
inlinr heartbeat \
  --entity <path> \
  --time <unix_float> \
  --project-git-remote <url> \
  [--branch <name>] \
  [--language <id>] \
  [--category coding|debugging|building|code-reviewing|writing-tests] \
  [--write] \
  [--lineno <n>] [--cursorpos <n>] [--lines-in-file <n>] \
  [--ai-tool copilot|cursor|claude-code|codeium|windsurf|aider] \
  [--editor vscode|cursor|windsurf|vscode-insiders] \
  [--editor-version 1.99.3] \
  [--plugin vscode-inlinr/0.1.0] \
  [--extra-heartbeats]    # flag → reads JSON array of Beat from stdin
```

### AI tool enum

`copilot` · `cursor` · `claude-code` · `codeium` · `windsurf` · `aider`. Anything else → omit the flag.
