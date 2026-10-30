# inlinr for VS Code

**Time tracking for developers — with AI-tool attribution.** A modern, privacy-first alternative to WakaTime, built for freelancers who bill by the hour and devs who want to know how much of their code actually came from them.

## Why inlinr

- **AI tool attribution.** See exactly how much you coded with Copilot, Cursor, Claude Code, Codeium, Windsurf, or Aider — per project, per week. Not just "AI time" in aggregate.
- **Freelance-native.** Hourly rates, client share links, invoice-ready reports are part of the core product, not an add-on.
- **Privacy-first.** Only file paths and languages are tracked. Your source code never leaves your machine.
- **Works everywhere.** VS Code, Cursor, Windsurf, VSCodium. JetBrains + Neovim coming soon.

## How it works

The extension tracks your coding activity and sends lightweight heartbeats every ~2 minutes to [inlinr.com](https://inlinr.com). The dashboard shows you:

- Time per project, per day/week/month
- Breakdown by language, editor, and AI tool
- Billable hours with computed totals at your hourly rate
- Shareable read-only reports for your clients (PRO)

## Setup

1. Install the extension.
2. Click **inlinr · sign in** in the status bar — or run **inlinr: Sign in** from the command palette (`Cmd/Ctrl+Shift+P`).
3. Your browser opens on a one-time approval page. Sign in with GitHub.
4. You're done. The status bar updates with today's total within ~60 seconds.

The connection is the machine's, not the editor's: Cursor, Windsurf and the
inlinr plugin for Claude Code on the same machine use it too. If one of them is
already connected, there is nothing to sign in to. To stop tracking this
editor without signing the other plugins out, turn off `inlinr.enabled`;
**inlinr: Sign out** signs out the whole machine. **inlinr: Sign in** on a
machine already connected keeps its account; `inlinr activate --replace` in a
terminal moves the machine to another one.

### Requirements

Projects are keyed by their git `origin` remote. A folder with no git remote is tracked under its folder name instead (only the name is sent, never the path); turn `inlinr.trackFoldersWithoutGit` off to leave such folders out. The home folder, a drive's root and a folder holding several repositories are never tracked this way.

## Commands

| Command | What it does |
| --- | --- |
| `inlinr: Sign in` | Authorizes this install via the GitHub device flow. |
| `inlinr: Sign out` | Revokes this machine's token server-side and clears it locally. Every inlinr plugin on the machine shares it, so the Claude Code plugin is signed out too. |
| `inlinr: Open dashboard` | Opens [inlinr.com/dashboard](https://inlinr.com/dashboard) in your browser. |
| `inlinr: Doctor` | Prints config + server reachability for debugging. |
| `inlinr: Toggle status bar` | Shows/hides the clock in the status bar. |

## Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `inlinr.statusBarEnabled` | `true` | Show today's coding time in the status bar. |
| `inlinr.debug` | `false` | Write CLI logs to the inlinr output channel. |

## Privacy

Only these fields are sent to the server, per heartbeat:

- File path (relative to the workspace root)
- Language ID (from VS Code)
- Branch name
- Editor + plugin version
- Which AI extension is active (if any)
- Total lines in the file, cursor position
- Timestamp

When the extension cannot download or start its CLI, it tells inlinr once a
day: the step that failed, the error with your home folder replaced by `~`,
the extension version, operating system and editor. No token, no file
content. Nothing is sent while VS Code's telemetry is off
(`telemetry.telemetryLevel`).

**What is never sent**: file contents, project names (other than what git remote exposes, or the folder's name when it has no remote), your keystrokes, your clipboard, any personal identifiers beyond the GitHub account you signed in with.

## Forks of VS Code

Cursor, Windsurf, VSCodium users: install from [Open VSX](https://open-vsx.org/extension/inlinr/inlinr-vscode) instead of the VS Code Marketplace. AI-tool attribution auto-detects the fork — no extra config.

## Troubleshooting

- **Status bar still says "sign in" after signing in.** It polls every 60 s; give it a minute, or re-run **inlinr: Sign in**.
- **Dashboard shows no time.** Check that the file is inside a workspace folder: a file opened on its own, outside any folder, is not tracked. A folder with no git remote is tracked by its name unless `inlinr.trackFoldersWithoutGit` is off.
- **Anything else.** Run **inlinr: Doctor** and check the **inlinr** output channel (`View → Output → inlinr`). Enable `inlinr.debug` for verbose CLI logs.

## Links

- Dashboard: [inlinr.com](https://inlinr.com)
- CLI: [github.com/inlinrhq/inlinr-cli](https://github.com/inlinrhq/inlinr-cli)
- Source: [github.com/inlinrhq/inlinr-vscode](https://github.com/inlinrhq/inlinr-vscode)

## License

BSD-3 — see [LICENSE](LICENSE).

Heartbeat fields and CLI flag names follow the [WakaTime](https://github.com/wakatime/vscode-wakatime)
plugin convention, so porting an existing WakaTime editor plugin is mostly
mechanical. The compatibility is deliberate and it is a matter of interface.
