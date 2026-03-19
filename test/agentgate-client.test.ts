import "dotenv/config";
import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import {
  loadOrCreateKeypair,
  createIdentity,
  postBond,
  executeBondedAction,
  resolveAction,
  type AgentKeys,
} from "../src/agentgate-client";

// ---------------------------------------------------------------------------
// Unit tests — always run
// ---------------------------------------------------------------------------

describe("agentgate-client — unit tests", () => {
  it("throws if AGENTGATE_REST_KEY is not set", async () => {
    const saved = process.env.AGENTGATE_REST_KEY;
    delete process.env.AGENTGATE_REST_KEY;

    const keys = loadOrCreateKeypair();
    await expect(createIdentity(keys)).rejects.toThrow("AGENTGATE_REST_KEY not set");

    if (saved) process.env.AGENTGATE_REST_KEY = saved;
  });

  it("generates a valid keypair", () => {
    const keys = loadOrCreateKeypair();
    expect(typeof keys.publicKey).toBe("string");
    expect(typeof keys.privateKey).toBe("string");
    expect(keys.publicKey.length).toBeGreaterThan(0);
    expect(keys.privateKey.length).toBeGreaterThan(0);

    // Confirm base64 format
    expect(() => Buffer.from(keys.publicKey, "base64")).not.toThrow();
    expect(() => Buffer.from(keys.privateKey, "base64")).not.toThrow();
  });

  it("persists keypair to file and reloads it", () => {
    // Remove any existing identity file
    const identityPath = "agent-identity.json";
    if (fs.existsSync(identityPath)) fs.unlinkSync(identityPath);

    const keys1 = loadOrCreateKeypair();
    expect(fs.existsSync(identityPath)).toBe(true);

    const keys2 = loadOrCreateKeypair();
    expect(keys2.publicKey).toBe(keys1.publicKey);
    expect(keys2.privateKey).toBe(keys1.privateKey);

    // Clean up
    fs.unlinkSync(identityPath);
  });
});

// ---------------------------------------------------------------------------
// Integration tests — only run when AgentGate is available
// ---------------------------------------------------------------------------

// Only run integration tests when both vars are set AND the key isn't the placeholder
const HAS_AGENTGATE = !!process.env.AGENTGATE_URL &&
  !!process.env.AGENTGATE_REST_KEY &&
  !process.env.AGENTGATE_REST_KEY.includes("your-");

describe.skipIf(!HAS_AGENTGATE)("agentgate-client — integration tests (live AgentGate)", () => {
  let keys: AgentKeys;
  let identityId: string;

  it("creates an identity", async () => {
    keys = loadOrCreateKeypair();
    identityId = await createIdentity(keys);
    expect(typeof identityId).toBe("string");
    expect(identityId.startsWith("id_")).toBe(true);
  });

  it("posts a bond", async () => {
    const bond = await postBond(keys, identityId, 100, 300, "email-rewrite test");
    expect(typeof bond.bondId).toBe("string");
    expect(bond.status).toBe("active");
  });

  it("full lifecycle: identity → bond → execute → resolve", async () => {
    const freshKeys = loadOrCreateKeypair();
    const id = await createIdentity(freshKeys);

    const bond = await postBond(freshKeys, id, 100, 300, "lifecycle test");
    const bondId = bond.bondId as string;

    const action = await executeBondedAction(freshKeys, id, bondId, "email-rewrite", { test: true }, 80);
    const actionId = action.actionId as string;
    expect(actionId.startsWith("action_")).toBe(true);

    const resolution = await resolveAction(freshKeys, actionId, "success");
    expect(resolution.outcome).toBe("success");
  });

  afterEach(() => {
    // Clean up identity file
    if (fs.existsSync("agent-identity.json")) fs.unlinkSync("agent-identity.json");
  });
});
