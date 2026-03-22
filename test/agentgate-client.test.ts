import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  loadOrCreateKeypair,
  createIdentity,
  postBond,
  executeBondedAction,
  resolveAction,
  type AgentKeys,
} from "../src/agentgate-client";

// ---------------------------------------------------------------------------
// Use a temporary identity file so tests never touch the real one
// ---------------------------------------------------------------------------

const TEST_IDENTITY_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "agent003-test-"));
const TEST_IDENTITY_FILE = path.join(TEST_IDENTITY_DIR, "agent-identity-test.json");

let savedIdentityFile: string | undefined;

beforeAll(() => {
  savedIdentityFile = process.env.AGENT_IDENTITY_FILE;
  process.env.AGENT_IDENTITY_FILE = TEST_IDENTITY_FILE;
});

afterAll(() => {
  // Restore original env
  if (savedIdentityFile !== undefined) {
    process.env.AGENT_IDENTITY_FILE = savedIdentityFile;
  } else {
    delete process.env.AGENT_IDENTITY_FILE;
  }

  // Clean up temp directory
  if (fs.existsSync(TEST_IDENTITY_FILE)) fs.unlinkSync(TEST_IDENTITY_FILE);
  if (fs.existsSync(TEST_IDENTITY_DIR)) fs.rmdirSync(TEST_IDENTITY_DIR);
});

// ---------------------------------------------------------------------------
// Unit tests — always run
// ---------------------------------------------------------------------------

describe("agentgate-client — unit tests", () => {
  it("throws if AGENTGATE_REST_KEY is not set and no saved identity", async () => {
    const savedKey = process.env.AGENTGATE_REST_KEY;
    delete process.env.AGENTGATE_REST_KEY;

    // Remove saved identity so createIdentity must call the API
    const savedFile = fs.existsSync(TEST_IDENTITY_FILE) ? fs.readFileSync(TEST_IDENTITY_FILE, "utf8") : null;
    if (fs.existsSync(TEST_IDENTITY_FILE)) fs.unlinkSync(TEST_IDENTITY_FILE);

    try {
      const keys = loadOrCreateKeypair();
      await expect(createIdentity(keys)).rejects.toThrow("AGENTGATE_REST_KEY not set");
    } finally {
      // Restore
      if (savedKey) process.env.AGENTGATE_REST_KEY = savedKey;
      if (savedFile) fs.writeFileSync(TEST_IDENTITY_FILE, savedFile, "utf8");
      else if (fs.existsSync(TEST_IDENTITY_FILE)) fs.unlinkSync(TEST_IDENTITY_FILE);
    }
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
    // Remove any existing test identity file
    if (fs.existsSync(TEST_IDENTITY_FILE)) fs.unlinkSync(TEST_IDENTITY_FILE);

    const keys1 = loadOrCreateKeypair();
    expect(fs.existsSync(TEST_IDENTITY_FILE)).toBe(true);

    const keys2 = loadOrCreateKeypair();
    expect(keys2.publicKey).toBe(keys1.publicKey);
    expect(keys2.privateKey).toBe(keys1.privateKey);

    // Clean up
    fs.unlinkSync(TEST_IDENTITY_FILE);
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
    // Clean up test identity file between integration tests
    if (fs.existsSync(TEST_IDENTITY_FILE)) fs.unlinkSync(TEST_IDENTITY_FILE);
  });
});
