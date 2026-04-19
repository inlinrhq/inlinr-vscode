# Changelog

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
