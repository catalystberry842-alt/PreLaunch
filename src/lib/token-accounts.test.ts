import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  associatedTokenAddress,
  isOnCurve,
  mergeBySignature,
  preStockHistoryAccounts,
  selectSignatures,
} from "./token-accounts.ts";
import { decodeBase58, encodeBase58 } from "./solana-address.ts";

// Real mainnet pairs: this owner's Token-2022 ATAs for two PreStock mints, as
// returned by getTokenAccountsByOwner. (This owner is itself program-derived,
// i.e. off-curve; ATAs are derived the same way.)
const owner = "FKLvPhPRzU1AUve7Dm2ijsmPDyVjzMumTNMbqMondJwi";
const anthropicMint = "Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw";
const anthropicAta = "36fFsu8YeTQLwpfZFPbtF9VnDWcknbTJEeFXwdPepqjE";
const spacexMint = "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh";
const spacexAta = "9neXYpYsSEdAZh6Nf2k8dUSgprzNgWWJVtwoJxLEtCPn";

describe("base58", () => {
  it("round-trips a public key", () => {
    const bytes = decodeBase58(anthropicMint);
    assert.ok(bytes);
    assert.equal(encodeBase58(bytes), anthropicMint);
  });
  it("keeps leading zero bytes as 1s", () => {
    assert.equal(encodeBase58(new Uint8Array(32)), "11111111111111111111111111111111");
  });
});

describe("associatedTokenAddress", () => {
  it("derives the Token-2022 ATA that exists on mainnet", () => {
    assert.equal(associatedTokenAddress(owner, anthropicMint), anthropicAta);
    assert.equal(associatedTokenAddress(owner, spacexMint), spacexAta);
  });
  it("derives an off-curve address", () => {
    const bytes = decodeBase58(anthropicAta);
    assert.ok(bytes);
    assert.equal(isOnCurve(bytes), false);
  });
  it("recognises a signer wallet as on-curve and a program-derived owner as off-curve", () => {
    const signer = decodeBase58("CsMPKmXFQne1ku75JGpZT34iFT6KGiuQ3DWxyBRhTCM6");
    const pda = decodeBase58(owner);
    assert.ok(signer && pda);
    assert.equal(isOnCurve(signer), true);
    assert.equal(isOnCurve(pda), false);
  });
});

describe("preStockHistoryAccounts", () => {
  it("keeps open catalog-mint accounts and adds each derived ATA once", () => {
    const accounts = preStockHistoryAccounts(
      owner,
      [
        { address: anthropicAta, mint: anthropicMint },
        { address: "Other1111111111111111111111111111111111111", mint: anthropicMint },
        { address: "NotCatalog11111111111111111111111111111111", mint: "So11111111111111111111111111111111111111112" },
      ],
      [anthropicMint, spacexMint],
    );
    assert.deepEqual(
      accounts.map((item) => [item.address, item.mint, item.open]),
      [
        [anthropicAta, anthropicMint, true],
        ["Other1111111111111111111111111111111111111", anthropicMint, true],
        [spacexAta, spacexMint, false],
      ],
    );
  });
});

describe("mergeBySignature", () => {
  it("drops transactions seen in more than one token account", () => {
    const merged = mergeBySignature([
      [{ signature: "a" }, { signature: "b" }],
      [{ signature: "b" }, { signature: "c" }],
    ]);
    assert.deepEqual(
      merged.map((item) => (item as { signature: string }).signature),
      ["a", "b", "c"],
    );
  });
});

describe("selectSignatures", () => {
  it("takes complete small accounts first and marks the rest partial", () => {
    const plan = selectSignatures(
      [
        { mint: "BIG", signatures: ["b1", "b2", "b3", "b4", "b5"], truncated: false },
        { mint: "SMALL", signatures: ["s1", "s2"], truncated: false },
        { mint: "CUT", signatures: ["c1", "c2"], truncated: true },
      ],
      4,
      1,
    );
    assert.deepEqual(plan.signatures, ["s1", "s2", "c1", "b1"]);
    assert.deepEqual(plan.truncatedMints.sort(), ["BIG", "CUT"]);
  });
  it("reports nothing truncated when everything fits", () => {
    const plan = selectSignatures(
      [{ mint: "A", signatures: ["x", "y"], truncated: false }],
      10,
      5,
    );
    assert.deepEqual(plan.signatures, ["x", "y"]);
    assert.deepEqual(plan.truncatedMints, []);
  });
});
