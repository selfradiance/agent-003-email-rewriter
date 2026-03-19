import "dotenv/config";
import { describe, it, expect, afterAll } from "vitest";
import fs from "node:fs";
import { rewriteEmail } from "../src/rewriter";
import {
  loadOrCreateKeypair,
  createIdentity,
  postBond,
  executeBondedAction,
  resolveAction,
} from "../src/agentgate-client";

const HAS_BOTH = !!process.env.ANTHROPIC_API_KEY &&
  !!process.env.AGENTGATE_REST_KEY &&
  !process.env.AGENTGATE_REST_KEY.includes("your-");

const SAMPLE_EMAIL = "hey bob, can u send me the report asap?? thx";
const INSTRUCTION = "make this more professional";

describe.skipIf(!HAS_BOTH)("full lifecycle — approve path", () => {
  afterAll(() => {
    if (fs.existsSync("agent-identity.json")) fs.unlinkSync("agent-identity.json");
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
    if (fs.existsSync("agent-identity.json")) fs.unlinkSync("agent-identity.json");
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
