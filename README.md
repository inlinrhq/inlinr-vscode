# Inlinr for VS Code

**Time tracking for developers — with AI-tool attribution.** A modern, privacy-first alternative to WakaTime, built for freelancers who bill by the hour and devs who want to know how much of their code actually came from them.

## Why Inlinr

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
2. Click **Inlinr · sign in** in the status bar — or run **Inlinr: Sign in** from the command palette (`Cmd/Ctrl+Shift+P`).
3. Your browser opens on a one-time approval page. Sign in with GitHub.
4. You're done. The status bar updates with today's total within ~60 seconds.

### Requirements

Projects are keyed by their git `origin` remote. If a workspace has no git remote, heartbeats are buffered but never uploaded — the dashboard will look empty. Run `git remote add origin <url>` (or open a folder that has one) to start tracking.

## Commands

| Command | What it does |
| --- | --- |
| `Inlinr: Sign in` | Authorizes this install via the GitHub device flow. |
| `Inlinr: Sign out` | Revokes this device's token server-side and clears it locally. |
| `Inlinr: Open dashboard` | Opens [inlinr.com/dashboard](https://inlinr.com/dashboard) in your browser. |
| `Inlinr: Doctor` | Prints config + server reachability for debugging. |
| `Inlinr: Toggle status bar` | Shows/hides the clock in the status bar. |

## Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `inlinr.statusBarEnabled` | `true` | Show today's coding time in the status bar. |
| `inlinr.debug` | `false` | Write CLI logs to the Inlinr output channel. |

## Privacy

Only these fields are sent to the server, per heartbeat:

- File path (relative to the workspace root)
- Language ID (from VS Code)
- Branch name
- Editor + plugin version
- Which AI extension is active (if any)
- Total lines in the file, cursor position
- Timestamp

**What is never sent**: file contents, project names (other than what git remote exposes), your keystrokes, your clipboard, any personal identifiers beyond the GitHub account you signed in with.

## Forks of VS Code

Cursor, Windsurf, VSCodium users: install from [Open VSX](https://open-vsx.org/extension/inlinrhq/inlinr-vscode) instead of the VS Code Marketplace. AI-tool attribution auto-detects the fork — no extra config.

## Troubleshooting

- **Status bar still says "sign in" after signing in.** It polls every 60 s; give it a minute, or re-run **Inlinr: Sign in**.
- **Dashboard shows no time.** Check that your workspace has a git `origin` remote (see [Requirements](#requirements)) — without one, heartbeats aren't uploaded.
- **Anything else.** Run **Inlinr: Doctor** and check the **Inlinr** output channel (`View → Output → Inlinr`). Enable `inlinr.debug` for verbose CLI logs.

## Links

- Dashboard: [inlinr.com](https://inlinr.com)
- CLI: [github.com/inlinrhq/inlinr-cli](https://github.com/inlinrhq/inlinr-cli)
- Source: [github.com/inlinrhq/inlinr-vscode](https://github.com/inlinrhq/inlinr-vscode)

## License

BSD-3. Structure modelled on [vscode-wakatime](https://github.com/wakatime/vscode-wakatime) (also BSD-3).
