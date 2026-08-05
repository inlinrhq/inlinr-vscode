# Changelog

## 0.3.1

### Fixed

- **Windsurf and VS Code Insiders were reported as plain `vscode` on every
  heartbeat.** The fork check existed twice and the copies had drifted: the one
  used at sign-in knew Cursor, Windsurf and Insiders, while the one used on
  every beat knew only Cursor. So a Windsurf user's device registered correctly
  and then sent beats labelled `vscode` from then on, and any per-editor
  breakdown counted Windsurf at zero.

  The server cannot recover this on its own: all VS Code forks run this same
  extension — that is why it is published to OpenVSX — so the plugin
  user-agent is `vscode-inlinr/x.y.z` everywhere and the editor field is the
  only thing that can tell them apart.

  Both paths now share one implementation. Beats already recorded keep the
  wrong label: the information was never sent, so there is nothing to correct
  after the fact.

### Added

- The host editor's version is now reported. Inside a fork this is the
  **embedded VS Code build**, not the fork's own release — neither Cursor nor
  Windsurf exposes its version to extensions — so it reads as "which VS Code
  baseline this install runs on", never as a Cursor version.

  Requires `inlinr` CLI v0.2.1 or newer, which the extension upgrades on its
  own about a minute after startup.

## 0.3.0

### Fixed

- **AI attribution no longer reports a tool that was merely installed.**
  `detectAITool()` returned a tool as soon as its extension was active, and
  Copilot activates at startup — so every heartbeat from everyone who had it
  installed reported `aiTool: copilot`, whether or not they had ever accepted a
  completion, and no other assistant was ever reported. Presence now only
  *names* the tool; a beat carries one only when something in the window looked
  like an assistant wrote it.

  The consequence worth knowing: `editor` and `aiTool` are now independent.
  Typing by hand inside Cursor yields `editor: cursor` with no AI tool, which
  the previous version could not express.

- **Worktrees resolve to their parent repository.** `.git` is read directly
  when the git extension has not indexed a worktree, following `gitdir:` to
  `commondir` for the remote while keeping the worktree's own branch.

- `@types/vscode` pinned back to match `engines.vscode`. It had drifted ahead,
  which would have let code compile against APIs missing from the oldest
  supported VS Code — a runtime crash for those users, invisible at build time.


## 0.2.0

- **Sign out** is now wired up: confirm dialog → spawns `inlinr signout` to revoke the device token server-side and clear it locally.
- **CLI auto-upgrade**: a background `inlinr upgrade` runs every 4 hours (60 s after activation), so users get CLI fixes without reinstalling the extension.
- Sign-in now refreshes the status bar total immediately on success, instead of waiting for the next 60 s poll.
- README: added Requirements (git-remote gotcha) and Troubleshooting sections; removed a broken screenshot link.
- Internal: unit tests for AI-tool detection (host-app precedence over extension ID).

## 0.1.1

- Fix: status bar "Sign in" now actually triggers sign-in instead of opening the dashboard.
- Remove `inlinr.apiUrl` setting — server URL is fixed to https://inlinr.com.

## 0.1.0 — Initial release

- Automatic heartbeat tracking on file edits, saves, selection changes, tab switches.
- Device-flow authentication (no API keys to paste).
- AI-tool attribution: Copilot, Cursor, Claude Code, Codeium, Windsurf, Aider.
- Status bar shows today's total coding time, polled every 60 seconds.
- Commands: Sign in, Sign out, Open dashboard, Doctor, Toggle status bar.
- Auto-downloads and SHA-verifies the `inlinr` CLI on first activation.
