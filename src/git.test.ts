import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { readGitContext } from "./git-fs";

const created: string[] = [];

function tmpDir(): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "inlinr-git-"));
	created.push(dir);
	return dir;
}

function write(file: string, contents: string) {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, contents, "utf8");
}

const CONFIG = `[core]
	repositoryformatversion = 0
[remote "origin"]
	url = git@github.com:acme/app.git
	fetch = +refs/heads/*:refs/remotes/origin/*
[branch "main"]
	remote = origin
`;

afterEach(() => {
	for (const dir of created.splice(0)) {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

describe("readGitContext", () => {
	it("reads remote and branch from a normal clone", () => {
		const repo = tmpDir();
		write(path.join(repo, ".git", "config"), CONFIG);
		write(path.join(repo, ".git", "HEAD"), "ref: refs/heads/main\n");

		expect(readGitContext(repo)).toEqual({
			remote: "git@github.com:acme/app.git",
			branch: "main",
		});
	});

	it("walks up from a nested directory", () => {
		const repo = tmpDir();
		write(path.join(repo, ".git", "config"), CONFIG);
		write(path.join(repo, ".git", "HEAD"), "ref: refs/heads/main\n");
		const nested = path.join(repo, "apps", "api", "src");
		fs.mkdirSync(nested, { recursive: true });

		expect(readGitContext(nested).remote).toBe(
			"git@github.com:acme/app.git",
		);
	});

	it("gives a worktree the parent's remote and its own branch", () => {
		// This is the `app-pr755` case: a worktree used to yield no remote at
		// all, so its beats were dropped or landed in a phantom project.
		const root = tmpDir();
		const repo = path.join(root, "app");
		const worktree = path.join(root, "app-pr755");

		write(path.join(repo, ".git", "config"), CONFIG);
		write(path.join(repo, ".git", "HEAD"), "ref: refs/heads/main\n");

		const wtGitDir = path.join(repo, ".git", "worktrees", "app-pr755");
		write(path.join(wtGitDir, "HEAD"), "ref: refs/heads/pr755\n");
		write(path.join(wtGitDir, "commondir"), "../..\n");
		fs.mkdirSync(worktree, { recursive: true });
		write(path.join(worktree, ".git"), `gitdir: ${wtGitDir}\n`);

		expect(readGitContext(worktree)).toEqual({
			remote: "git@github.com:acme/app.git",
			branch: "pr755",
		});
	});

	it("resolves a relative gitdir pointer", () => {
		const root = tmpDir();
		const repo = path.join(root, "app");
		const worktree = path.join(root, "app-wt");

		write(path.join(repo, ".git", "config"), CONFIG);
		const wtGitDir = path.join(repo, ".git", "worktrees", "app-wt");
		write(path.join(wtGitDir, "HEAD"), "ref: refs/heads/feature\n");
		write(path.join(wtGitDir, "commondir"), "../..\n");
		fs.mkdirSync(worktree, { recursive: true });
		write(path.join(worktree, ".git"), "gitdir: ../app/.git/worktrees/app-wt\n");

		expect(readGitContext(worktree)).toEqual({
			remote: "git@github.com:acme/app.git",
			branch: "feature",
		});
	});

	it("falls back to the first remote when there is no origin", () => {
		const repo = tmpDir();
		write(
			path.join(repo, ".git", "config"),
			'[remote "upstream"]\n\turl = https://gitlab.com/g/p.git\n',
		);
		write(path.join(repo, ".git", "HEAD"), "ref: refs/heads/trunk\n");

		expect(readGitContext(repo)).toEqual({
			remote: "https://gitlab.com/g/p.git",
			branch: "trunk",
		});
	});

	it("returns a null branch when HEAD is detached", () => {
		const repo = tmpDir();
		write(path.join(repo, ".git", "config"), CONFIG);
		write(path.join(repo, ".git", "HEAD"), "9f2c1ab0c0ffee\n");

		expect(readGitContext(repo).branch).toBeNull();
	});

	it("returns nulls outside a repository", () => {
		expect(readGitContext(tmpDir())).toEqual({ remote: null, branch: null });
	});
});
