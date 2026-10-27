// What makes a downloaded CLI trustworthy: SHA256SUMS.txt signed with
// Inlinr's release key (inlinr-cli's release.yml), then the binary's hash
// listed in it. The hash alone only proved the binary matched a list
// published beside it. No vscode import, so it can be tested on its own.

import * as crypto from "node:crypto";

/** The public half of the key inlinr-cli's releases are signed with. */
export const RELEASE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA4+NGj0EwOtNTjlQP4ES+5VJW8n7OSdDdF3XcEK+bKkU=
-----END PUBLIC KEY-----
`;

/** Throws unless `sig` signs `sums` and `sums` lists `bin` under `name`. */
export function verifyRelease(
  bin: Buffer,
  name: string,
  sums: Buffer,
  sig: Buffer,
  publicKey: string = RELEASE_PUBLIC_KEY,
): void {
  if (!crypto.verify(null, sums, publicKey, sig)) {
    throw new Error("SHA256SUMS.txt signature does not match the release key");
  }
  const expected = parseSha(sums.toString(), name);
  if (!expected) throw new Error(`no SHA256 entry for ${name}`);
  const actual = crypto.createHash("sha256").update(bin).digest("hex");
  if (expected !== actual) {
    throw new Error(`SHA256 mismatch: expected ${expected}, got ${actual}`);
  }
}

function parseSha(manifest: string, name: string): string | null {
  for (const line of manifest.split(/\r?\n/)) {
    const [sha, file] = line.trim().split(/\s+/);
    if (file === name) return sha ?? null;
  }
  return null;
}
