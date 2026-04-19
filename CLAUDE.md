# inlinr-vscode

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
  ai-detect.ts      # which AI assistant is active (extension ID map + app name)
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
the manifest, and writes to `ctx.globalStorageUri`. No version check on every
launch yet — TODO: poll GitHub API every 4h, upgrade.

## AI tool detection

Order of precedence in `ai-detect.ts`:
1. App name (Cursor, Windsurf always win — they're VS Code forks).
2. Installed-and-active extension ID (Copilot, Claude Code, Codeium, Aider, …).

The mapped value is the wire enum: `copilot` · `cursor` · `claude-code` · `codeium` · `windsurf` · `aider`.

## Commands

```
Inlinr: Sign in            # spawn `inlinr activate --editor <id>`
Inlinr: Sign out           # TODO — revoke device token
Inlinr: Open dashboard     # browser → https://inlinr.com/dashboard
Inlinr: Doctor             # spawn `inlinr doctor`
Inlinr: Toggle status bar  # hide/show the clock item
```

## What's missing / TODO

- **Project git remote resolution.** Currently unset → tracker skips the flush. Needs the built-in `vscode.git` extension API (`vscode.extensions.getExtension('vscode.git').exports.getAPI(1)` → `repositories[i].state.remotes`). Until wired, no heartbeats actually get sent.
- **Sign out.** Placeholder in `commands.ts` — needs `POST /api/auth/device/revoke` on the server and CLI-side `inlinr signout`.
- **Status bar time.** `tracker.refreshStatusBar` only shows a static label. Needs to poll the server (or a local summary) and display today's total.
- **CLI auto-upgrade.** Currently only downloads once. Needs periodic version check against GitHub API.

## Marketplaces

- VS Code Marketplace: `vsce publish` (publisher: `inlinr`).
- OpenVSX: `ovsx publish` — required for Cursor + Windsurf users (they don't have Marketplace access).
- Release workflow: tag `vX.Y.Z` → GitHub Actions builds, signs .vsix, uploads to both marketplaces + GitHub Release.

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
  [--editor vscode|cursor|windsurf|...] \
  [--plugin vscode-inlinr/0.1.0] \
  [--extra-heartbeats]    # flag → reads JSON array of Beat from stdin
```

### AI tool enum

`copilot` · `cursor` · `claude-code` · `codeium` · `windsurf` · `aider`. Anything else → omit the flag.
