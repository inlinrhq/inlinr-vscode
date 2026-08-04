// Reading git metadata straight off disk, with no dependency on the `vscode`
// module — which is why it lives apart from `git.ts`: it is unit-testable.
//
// Used as the fallback when VS Code's git extension hasn't indexed a folder.

import * as fs from "fs";
import * as path from "path";

export type GitContext = { remote: string | null; branch: string | null };

/**
 * Walk up from `startDir` looking for `.git`, then read the origin remote and
 * HEAD out of it.
 *
 * `.git` is a directory in a normal clone and a *file* in a worktree or
 * submodule (`gitdir: /path/to/repo/.git/worktrees/<name>`). For a worktree the
 * config — and therefore the remote — lives in the common directory, which the
 * `commondir` file points at; the branch stays worktree-local. That split is
 * exactly what we want: same project, different branch. Mirrors what
 * wakatime-cli does in `pkg/project/git.go`.
 */
export function readGitContext(startDir: string): GitContext {
	const gitPath = findGitPath(startDir);
	if (!gitPath) return { remote: null, branch: null };

	const gitDir = resolveGitDir(gitPath);
	if (!gitDir) return { remote: null, branch: null };

	const commonDir = resolveCommonDir(gitDir);
	return {
		remote: readOriginUrl(path.join(commonDir, "config")),
		branch: readHeadBranch(path.join(gitDir, "HEAD")),
	};
}

function findGitPath(startDir: string): string | null {
	let dir = startDir;
	// Bounded walk — a repo nested more than 40 levels deep isn't a real case.
	for (let i = 0; i < 40; i++) {
		const candidate = path.join(dir, ".git");
		if (fs.existsSync(candidate)) return candidate;
		const parent = path.dirname(dir);
		if (parent === dir) return null;
		dir = parent;
	}
	return null;
}

/** `.git` directory, or the path a `.git` *file* points at. */
function resolveGitDir(gitPath: string): string | null {
	try {
		if (fs.statSync(gitPath).isDirectory()) return gitPath;
		const contents = fs.readFileSync(gitPath, "utf8");
		const match = contents.match(/^gitdir:\s*(.+)$/m);
		if (!match) return null;
		const target = match[1].trim();
		return path.isAbsolute(target)
			? target
			: path.resolve(path.dirname(gitPath), target);
	} catch {
		return null;
	}
}

/** For a worktree, the shared repo directory holding `config`. */
function resolveCommonDir(gitDir: string): string {
	try {
		const commonDirFile = path.join(gitDir, "commondir");
		if (!fs.existsSync(commonDirFile)) return gitDir;
		const target = fs.readFileSync(commonDirFile, "utf8").trim();
		if (!target) return gitDir;
		return path.isAbsolute(target) ? target : path.resolve(gitDir, target);
	} catch {
		return gitDir;
	}
}

/** Minimal git-config reader: the url of `[remote "origin"]`, else any remote. */
function readOriginUrl(configPath: string): string | null {
	let text: string;
	try {
		text = fs.readFileSync(configPath, "utf8");
	} catch {
		return null;
	}

	let section: string | null = null;
	let firstRemoteUrl: string | null = null;
	for (const rawLine of text.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (line.startsWith("[")) {
			const m = line.match(/^\[remote\s+"([^"]+)"\]$/);
			section = m ? m[1] : null;
			continue;
		}
		if (!section) continue;
		const m = line.match(/^url\s*=\s*(.+)$/);
		if (!m) continue;
		const url = m[1].trim();
		if (section === "origin") return url;
		if (!firstRemoteUrl) firstRemoteUrl = url;
	}
	return firstRemoteUrl;
}

/** `ref: refs/heads/<branch>` in HEAD; null when detached. */
function readHeadBranch(headPath: string): string | null {
	try {
		const head = fs.readFileSync(headPath, "utf8").trim();
		const m = head.match(/^ref:\s*refs\/heads\/(.+)$/);
		return m ? m[1].trim() : null;
	} catch {
		return null;
	}
}
