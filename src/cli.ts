// CLI entry point — orchestrates rewrite → bond → human verdict → resolve

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { rewriteEmail } from "./rewriter";
import { loadOrCreateKeypair, createIdentity, postBond, executeBondedAction, resolveAction } from "./agentgate-client";
import { askHumanVerdict } from "./prompt";
import { stripEscapes } from "./sanitize";

// ---------------------------------------------------------------------------
// Shared state for SIGINT cleanup
// ---------------------------------------------------------------------------

let pendingActionId: string | undefined;
let pendingKeys: ReturnType<typeof loadOrCreateKeypair> | undefined;
let cleanupInProgress = false;

async function resolveAndExit(reason: string): Promise<void> {
  if (cleanupInProgress) return;
  cleanupInProgress = true;

  if (pendingActionId && pendingKeys) {
    console.log(`\n${reason} — resolving open action as failed...`);
    try {
      await resolveAction(pendingKeys, pendingActionId, "failed");
      console.log(`Action ${pendingActionId} resolved as failed.`);
    } catch (err) {
      console.error(`Warning: failed to resolve action: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else if (reason) {
    console.log(`\n${reason}`);
  }

  process.exit(1);
}

process.on("SIGINT", () => {
  void resolveAndExit("Interrupted (Ctrl+C)");
});

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Parse arguments
  const filePath = process.argv[2];
  const instruction = process.argv[3];

  if (!filePath || !instruction) {
    console.error("Usage: npx tsx src/cli.ts <email-file> <instruction>");
    console.error("");
    console.error("Example:");
    console.error('  npx tsx src/cli.ts emails/sample.txt "make this more professional"');
    process.exit(1);
  }

  // Read the email file
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`Error: File not found: ${absolutePath}`);
    process.exit(1);
  }
  if (!fs.statSync(absolutePath).isFile()) {
    console.error(`Error: "${absolutePath}" is a directory, not a file`);
    process.exit(1);
  }

  const MAX_EMAIL_BYTES = 10_240; // 10KB — an email larger than this is almost certainly not a single email
  const fileSizeBytes = fs.statSync(absolutePath).size;
  if (fileSizeBytes > MAX_EMAIL_BYTES) {
    console.error(`Error: File is too large (${fileSizeBytes} bytes, max ${MAX_EMAIL_BYTES}). This agent is designed for single emails, not large files.`);
    process.exit(1);
  }

  const originalEmail = fs.readFileSync(absolutePath, "utf8").trim();
  if (!originalEmail) {
    console.error(`Error: File is empty: ${absolutePath}`);
    process.exit(1);
  }

  // Startup banner — sanitize user-provided text before printing
  const safeInstruction = stripEscapes(instruction);
  const agentGateUrl = process.env.AGENTGATE_URL ?? "http://127.0.0.1:3000";
  console.log("");
  console.log("  Agent 003 — Email Rewriter");
  console.log(`  File:         ${absolutePath}`);
  console.log(`  Instruction:  ${safeInstruction}`);
  console.log(`  AgentGate:    ${agentGateUrl}`);
  console.log("");

  let rewrittenEmail: string | undefined;

  try {
    // Step 1: Rewrite the email via Claude
    console.log("Rewriting email via Claude...");
    rewrittenEmail = await rewriteEmail(originalEmail, instruction);
    console.log("Rewrite complete.\n");

    // Step 2: AgentGate lifecycle — identity, bond, action
    console.log("Connecting to AgentGate...");
    const keys = loadOrCreateKeypair();
    const identityId = await createIdentity(keys);
    console.log(`Identity: ${identityId}`);

    const bond = await postBond(keys, identityId, 100, 300, `email-rewrite: ${instruction}`);
    const bondId = bond.bondId as string;
    console.log(`Bond locked: ${bondId} (100 cents, 300s TTL)`);

    const exposureCents = Math.floor(100 / 1.2);
    const action = await executeBondedAction(keys, identityId, bondId, "email-rewrite", {
      instruction,
      originalLength: originalEmail.length,
      rewrittenLength: rewrittenEmail.length,
    }, exposureCents);
    const actionId = action.actionId as string;
    console.log(`Action started: ${actionId}\n`);

    // Make action visible to SIGINT handler during the prompt phase
    pendingActionId = actionId;
    pendingKeys = keys;

    // Step 3: Ask the human
    const verdict = await askHumanVerdict(originalEmail, rewrittenEmail);

    // Action no longer needs SIGINT cleanup — we're handling it now
    pendingActionId = undefined;
    pendingKeys = undefined;

    // Handle abort (EOF on stdin or similar)
    if (verdict === "abort") {
      console.log("\nInput closed — resolving action as failed...");
      await resolveAction(keys, actionId, "failed");
      console.log(`Action ${actionId} resolved as failed.`);
      process.exit(1);
    }

    // Step 4: Resolve through AgentGate
    const outcome = verdict === "approve" ? "success" : "failed";
    await resolveAction(keys, actionId, outcome);

    // Step 5: Print result
    console.log("");
    console.log("════════════════════════════════════════");
    console.log("  RESULT");
    console.log("════════════════════════════════════════");
    console.log(`  Verdict:   ${verdict}`);
    console.log(`  Bond:      ${verdict === "approve" ? "released" : "slashed"}`);
    console.log(`  Action:    ${actionId}`);
    console.log("════════════════════════════════════════");
    console.log("");
  } catch (err) {
    // If rewrite succeeded but AgentGate/prompt failed, still show the rewrite
    if (rewrittenEmail) {
      console.log("\n── Rewrite was completed before the error ──");
      console.log(stripEscapes(rewrittenEmail));
      console.log("──────────────────────────────────────────\n");
    }

    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();
