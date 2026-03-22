import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { rewriteEmail } from "../src/rewriter";
import {
  loadOrCreateKeypair,
  createIdentity,
  postBond,
  executeBondedAction,
  resolveAction,
} from "../src/agentgate-client";

// ---------------------------------------------------------------------------
// Use a temporary identity file so tests never touch the real one
// ---------------------------------------------------------------------------

const TEST_IDENTITY_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "agent003-agent-test-"));
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

const HAS_BOTH = !!process.env.ANTHROPIC_API_KEY &&
  !!process.env.AGENTGATE_REST_KEY &&
  !process.env.AGENTGATE_REST_KEY.includes("your-");

const SAMPLE_EMAIL = "hey bob, can u send me the report asap?? thx";
const INSTRUCTION = "make this more professional";

describe.skipIf(!HAS_BOTH)("full lifecycle — approve path", () => {
  afterAll(() => {
    if (fs.existsSync(TEST_IDENTITY_FILE)) fs.unlinkSync(TEST_IDENTITY_FILE);
  });

  it("rewrite → bond → execute → resolve as success", async () => {
    // Step 1: Rewrite
    const rewritten = await rewriteEmail(SAMPLE_EMAIL, INSTRUCTION);
    expect(typeof rewritten).toBe("string");
    expect(rewritten.length).toBeGreaterThan(0);
    expect(rewritten).not.toBe(SAMPLE_EMAIL);

    // Step 2: AgentGate lifecycle — approve
    const keys = loadOrCreateKeypair();
    const identityId = await createIdentity(keys);
    expect(identityId.startsWith("id_")).toBe(true);

    const bond = await postBond(keys, identityId, 100, 300, `email-rewrite: ${INSTRUCTION}`);
    const bondId = bond.bondId as string;
    expect(bondId.startsWith("bond_")).toBe(true);

    const exposureCents = Math.floor(100 / 1.2);
    const action = await executeBondedAction(keys, identityId, bondId, "email-rewrite", {
      instruction: INSTRUCTION,
      originalLength: SAMPLE_EMAIL.length,
      rewrittenLength: rewritten.length,
    }, exposureCents);
    const actionId = action.actionId as string;
    expect(actionId.startsWith("action_")).toBe(true);

    const resolution = await resolveAction(keys, actionId, "success");
    expect(resolution.outcome).toBe("success");
  }, 30000);
});

describe.skipIf(!HAS_BOTH)("full lifecycle — reject path", () => {
  afterAll(() => {
    if (fs.existsSync(TEST_IDENTITY_FILE)) fs.unlinkSync(TEST_IDENTITY_FILE);
  });

  it("rewrite → bond → execute → resolve as failed", async () => {
    // Step 1: Rewrite
    const rewritten = await rewriteEmail(SAMPLE_EMAIL, INSTRUCTION);
    expect(rewritten.length).toBeGreaterThan(0);

    // Step 2: AgentGate lifecycle — reject
    const keys = loadOrCreateKeypair();
    const identityId = await createIdentity(keys);

    const bond = await postBond(keys, identityId, 100, 300, `email-rewrite: ${INSTRUCTION}`);
    const bondId = bond.bondId as string;

    const exposureCents = Math.floor(100 / 1.2);
    const action = await executeBondedAction(keys, identityId, bondId, "email-rewrite", {
      instruction: INSTRUCTION,
      originalLength: SAMPLE_EMAIL.length,
      rewrittenLength: rewritten.length,
    }, exposureCents);
    const actionId = action.actionId as string;

    const resolution = await resolveAction(keys, actionId, "failed");
    expect(resolution.outcome).toBe("failed");
  }, 30000);
});
