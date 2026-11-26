# Changelog

## 0.6.1

### Fixed

- **Agents' temporary folders.** A folder with no git remote used to become
  a project of its own, named after the folder: an agent's `git init` in
  `/tmp` gave a new project each time. When such a folder sits in a temporary
  place (the system's temp folder, a scratchpad, `.claude/worktrees/`, a
  cache), its time now goes to one project, `scratch`. A git worktree, in
  `.claude/worktrees/` or elsewhere, still counts in its own repository's
  project, as before: its remote is read from the repository it belongs to.

## 0.6.0

### Added

- **Pause tracking.** Pause tracking (30 minutes, 1 hour, 2 hours, or until
  you resume) and Resume tracking pause the whole machine: this editor and
  the Claude Code plugin send nothing meanwhile, then or later. The status
  bar shows the pause; click it to resume. Needs CLI 0.8.0, which the
  extension installs on its own.

### Fixed

- **The same file from Windows and from Claude Code.** On Windows a file's
  path was sent with `\`, so a file edited by hand and by the Claude Code
  plugin counted as two files. Paths are now sent with `/` on every system.

## 0.5.5

### Fixed

- **Two windows opening at once.** Each window downloaded the CLI under the
  same temporary name, and the second could fail and track nothing until
  VS Code restarted. Each window now writes its own copy, and a window that
  finds the CLI already installed by another one goes on.

## 0.5.4

### Changed

- **One connection per machine.** The extension and the inlinr plugin for
  Claude Code share the machine's sign-in: sign in from either and both
  track, sign out from either and both stop. The sign-out prompt says so.
  The status bar also finds a sign-in saved by a Claude Code plugin older
  than 0.7.0.
- **`inlinr.enabled`.** Off, this editor records and sends nothing, and the
  machine stays signed in for the Claude Code plugin.

## 0.5.3

### Changed

- **The name is written inlinr.** In the editor's font a capital I read as
  an l ("lnlinr"); the extension's name, its commands, the status bar and
  its messages now say inlinr, like the logo.

## 0.5.2

### Changed

- **New icon.** inlinr's new logo, a ring with its dot set apart, replaces
  the green dot in the Marketplace, OpenVSX and the Extensions view.

## 0.5.1

### Fixed

- **A failure inside the tracker is reported.** When the extension failed
  while preparing beats, before the CLI ran, only the inlinr output channel
  showed it. It is now sent to inlinr like the extension's other failures
  (only while VS Code's telemetry is on), so it can be fixed without waiting
  for someone to notice missing time.

## 0.5.0

### Added

- **Folders without a git remote are tracked.** A folder that is not a git
  repository, or a repository with no remote, used to send nothing. Its time
  now goes to a project named after the folder. Your home folder, a drive
  root and a folder that only holds other repositories are still skipped.
  Turn it off with `inlinr.trackFoldersWithoutGit`. Needs CLI 0.5.0, which
  the extension installs on its own.

### Changed

- **The CLI is installed only from a signed release.** The extension checks
  the release's signature with inlinr's release key before trusting its
  checksums, and refuses a binary the signed list does not hold.

### Fixed

- **Beats are kept when the CLI fails.** They used to be dropped when the CLI
  could not run; they are now kept in memory, retried, and sent when VS Code
  closes.

## 0.4.1

### Fixed

- The package no longer carries the repository's own tooling files
  (`.claude/`, `.githooks/`, `biome.json`).
- Published on OpenVSX, for Cursor and Windsurf: 0.4.0 only reached the
  VS Code Marketplace.

## 0.4.0

### Added

- **The extension tells inlinr when it cannot run the CLI.** A CLI that
  failed to download (no binary for the platform, a checksum mismatch), could
  not be started (missing, blocked by an antivirus) or refused a flag used to
  be a line in the inlinr output channel, and tracking silently stopped. These
  now reach inlinr, once a day for the same error: the step, the message with
  your home folder replaced by `~`, the extension version, operating system
  and editor. No token, no file content, nothing when the network is down.
  Nothing is sent while VS Code's telemetry is off.
- The package now ships the LICENSE file.

## 0.3.1

### Added

- **The editor's version is sent.** Inside Cursor or Windsurf it is the
  VS Code version the editor is built on, not the editor's own release,
  which neither shows to extensions. Needs CLI 0.2.1, which the extension
  installs on its own about a minute after startup.

### Fixed

- **Windsurf and VS Code Insiders were counted as VS Code.** The sign-in
  recognised them, but every beat after it was labelled `vscode`, so a
  breakdown by editor showed Windsurf at zero. Beats are now labelled with
  the right editor. Time recorded before this release keeps the old label:
  the editor was never sent, so it cannot be corrected afterwards.

## 0.3.0

### Fixed

- **An assistant is named only when it wrote something.** Copilot starts
  with VS Code, so every beat of everyone who had it installed was marked as
  Copilot's, used or not, and no other assistant was ever named. A beat now
  names an assistant only when an edit in that window looked like one an
  assistant made. Typing by hand in Cursor is now your time in Cursor, with
  no assistant.
- **Worktrees count in their repository.** When VS Code's git extension has
  not read a worktree yet, the extension reads its `.git` itself: the remote
  comes from the repository it belongs to, the branch is the worktree's own.
- The extension no longer risks using editor features missing from the
  oldest VS Code it supports.

## 0.2.0

- **Sign out** works: after a confirmation, the device is revoked on inlinr
  and its sign-in removed from this machine.
- **The CLI keeps itself up to date**: the extension checks for a new CLI a
  minute after VS Code starts, then every 4 hours.
- After signing in, the status bar shows today's time at once instead of up
  to a minute later.
- The README gained Requirements and Troubleshooting sections.

## 0.1.1

- Fixed: "Sign in" in the status bar signs in instead of opening the
  dashboard.
- The `inlinr.apiUrl` setting is removed: the server is always
  https://inlinr.com.

## 0.1.0 (first release)

- Automatic tracking on edits, saves, selection changes and tab switches.
- Sign in from the editor, with no API key to paste.
- Which assistant wrote the code: Copilot, Cursor, Claude Code, Codeium,
  Windsurf, Aider.
- The status bar shows today's coding time, updated every minute.
- Commands: Sign in, Sign out, Open dashboard, Doctor, Toggle status bar.
- The CLI is downloaded and checked on first start.
