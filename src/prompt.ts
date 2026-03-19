// Handles the terminal prompt where the human approves or rejects the rewrite.

import readline from "node:readline";

const SEPARATOR = "─".repeat(60);

const APPROVE_INPUTS = new Set(["approve", "a", "yes", "y"]);
const REJECT_INPUTS = new Set(["reject", "r", "no", "n"]);

export async function askHumanVerdict(
  originalEmail: string,
  rewrittenEmail: string,
): Promise<"approve" | "reject"> {
  console.log("");
  console.log(SEPARATOR);
  console.log("  ORIGINAL EMAIL:");
  console.log(SEPARATOR);
  console.log(originalEmail);
  console.log("");
  console.log(SEPARATOR);
  console.log("  REWRITTEN EMAIL:");
  console.log(SEPARATOR);
  console.log(rewrittenEmail);
  console.log("");
  console.log(SEPARATOR);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    while (true) {
      const answer = await new Promise<string>((resolve) => {
        rl.question("Do you approve this rewrite? (approve/reject): ", resolve);
      });

      const normalized = answer.trim().toLowerCase();

      if (APPROVE_INPUTS.has(normalized)) {
        return "approve";
      }
      if (REJECT_INPUTS.has(normalized)) {
        return "reject";
      }

      console.log("Please enter 'approve' or 'reject'");
    }
  } finally {
    rl.close();
  }
}
