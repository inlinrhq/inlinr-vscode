import * as crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { RELEASE_PUBLIC_KEY, verifyRelease } from "./release-key";

const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
const pub = publicKey.export({ type: "spki", format: "pem" }).toString();
const bin = Buffer.from("binary");
const hash = crypto.createHash("sha256").update(bin).digest("hex");
const sums = Buffer.from(`${hash}  inlinr-linux-amd64\n`);
const sig = crypto.sign(null, sums, privateKey);

describe("verifyRelease", () => {
  it("accepts a signed list that holds the binary", () => {
    expect(() =>
      verifyRelease(bin, "inlinr-linux-amd64", sums, sig, pub),
    ).not.toThrow();
  });

  it("refuses a list signed with another key", () => {
    const other = crypto.generateKeyPairSync("ed25519").privateKey;
    const forged = crypto.sign(null, sums, other);
    expect(() =>
      verifyRelease(bin, "inlinr-linux-amd64", sums, forged, pub),
    ).toThrow(/signature/);
  });

  it("refuses a binary the list does not hold", () => {
    expect(() =>
      verifyRelease(bin, "inlinr-darwin-arm64", sums, sig, pub),
    ).toThrow(/no SHA256 entry/);
    expect(() =>
      verifyRelease(Buffer.from("other"), "inlinr-linux-amd64", sums, sig, pub),
    ).toThrow(/mismatch/);
  });

  it("carries a real Ed25519 key", () => {
    const key = crypto.createPublicKey(RELEASE_PUBLIC_KEY);
    expect(key.asymmetricKeyType).toBe("ed25519");
  });
});
