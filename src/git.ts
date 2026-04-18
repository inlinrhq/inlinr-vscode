// Resolves the git remote + current branch of a document using VS Code's
// built-in `vscode.git` extension. The remote URL is what the server uses to
// upsert `Project` rows, so without it we can't send heartbeats.
//
// Results are cached per workspace folder for 60 s (git remote rarely changes,
// and this path is hit once per flush).

import * as vscode from "vscode";

// Minimal type shim for the vscode.git API (version 1). The full surface lives
// in microsoft/vscode/extensions/git/src/api/git.d.ts — we only need a slice.
type Remote = {
	readonly name: string;
	readonly fetchUrl?: string;
	readonly pushUrl?: string;
};
type RepositoryState = {
	readonly remotes: readonly Remote[];
	readonly HEAD?: { readonly name?: string };
};
type Repository = {
	readonly rootUri: vscode.Uri;
	readonly state: RepositoryState;
};
type GitAPI = {
	readonly state: "uninitialized" | "initialized";
	readonly onDidChangeState: vscode.Event<"uninitialized" | "initialized">;
	getRepository(uri: vscode.Uri): Repository | null;
};
type GitExtension = {
	readonly enabled: boolean;
	getAPI(version: 1): GitAPI;
};

let apiPromise: Promise<GitAPI | null> | null = null;

async function getGitAPI(): Promise<GitAPI | null> {
	if (apiPromise) return apiPromise;
	apiPromise = (async () => {
		const ext = vscode.extensions.getExtension<GitExtension>("vscode.git");
		if (!ext) return null;
		if (!ext.isActive) await ext.activate();
		const api = ext.exports.getAPI(1);
		if (api.state === "initialized") return api;
		// Wait for the git extension to finish scanning repositories.
		await new Promise<void>((resolve) => {
			const sub = api.onDidChangeState((state) => {
				if (state === "initialized") {
					sub.dispose();
					resolve();
				}
			});
		});
		return api;
	})();
	return apiPromise;
}

export type GitContext = { remote: string | null; branch: string | null };

const CACHE_TTL_MS = 60_000;
type CacheEntry = { value: GitContext; fetchedAt: number };
const cache = new Map<string, CacheEntry>();

export async function resolveGitContext(docUri: vscode.Uri): Promise<GitContext> {
	const folder = vscode.workspace.getWorkspaceFolder(docUri);
	if (!folder) return { remote: null, branch: null };

	const key = folder.uri.toString();
	const cached = cache.get(key);
	if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
		return cached.value;
	}

	const api = await getGitAPI();
	if (!api) return rememberAndReturn(key, { remote: null, branch: null });

	const repo = api.getRepository(docUri);
	if (!repo) return rememberAndReturn(key, { remote: null, branch: null });

	const origin =
		repo.state.remotes.find((r) => r.name === "origin") ?? repo.state.remotes[0];
	const remote = origin?.fetchUrl ?? origin?.pushUrl ?? null;
	const branch = repo.state.HEAD?.name ?? null;
	return rememberAndReturn(key, { remote, branch });
}

function rememberAndReturn(key: string, value: GitContext): GitContext {
	cache.set(key, { value, fetchedAt: Date.now() });
	return value;
}

// Invalidate cache when workspace folders change (rare, but avoids stale
// misses when the user closes+reopens a repo during a session).
export function watchWorkspaceChanges(subs: vscode.Disposable[]) {
	subs.push(
		vscode.workspace.onDidChangeWorkspaceFolders(() => cache.clear()),
	);
}
