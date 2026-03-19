// CLI entry point — orchestrates rewrite → bond → human verdict → resolve

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { rewriteEmail } from "./rewriter";
import { loadOrCreateKeypair, createIdentity, postBond, executeBondedAction, resolveAction } from "./agentgate-client";
import { askHumanVerdict } from "./prompt";

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

  const originalEmail = fs.readFileSync(absolutePath, "utf8").trim();
  if (!originalEmail) {
    console.error(`Error: File is empty: ${absolutePath}`);
    process.exit(1);
  }

  // Startup banner
  const agentGateUrl = process.env.AGENTGATE_URL ?? "http://127.0.0.1:3000";
  console.log("");
  console.log("  Agent 003 — Email Rewriter");
  console.log(`  File:         ${absolutePath}`);
  console.log(`  Instruction:  ${instruction}`);
  console.log(`  AgentGate:    ${agentGateUrl}`);
  console.log("");

  let rewrittenEmail: string | undefined;
  let actionId: string | undefined;

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
    actionId = action.actionId as string;
    console.log(`Action started: ${actionId}\n`);

    // Step 3: Ask the human
    const verdict = await askHumanVerdict(originalEmail, rewrittenEmail);

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
      console.log(rewrittenEmail);
      console.log("──────────────────────────────────────────\n");
    }

    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();
