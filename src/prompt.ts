// Handles the terminal prompt where the human approves or rejects the rewrite.

import readline from "node:readline";
import { stripEscapes } from "./sanitize";

const SEPARATOR = "─".repeat(60);

const APPROVE_INPUTS = new Set(["approve", "a", "yes", "y"]);
const REJECT_INPUTS = new Set(["reject", "r", "no", "n"]);

export type HumanVerdict = "approve" | "reject" | "abort";

export async function askHumanVerdict(
  originalEmail: string,
  rewrittenEmail: string,
): Promise<HumanVerdict> {
  const safeOriginal = stripEscapes(originalEmail);
  const safeRewrite = stripEscapes(rewrittenEmail);

  console.log("");
  console.log(SEPARATOR);
  console.log("  ORIGINAL EMAIL:");
  console.log(SEPARATOR);
  console.log(safeOriginal);
  console.log("");
  console.log(SEPARATOR);
  console.log("  REWRITTEN EMAIL:");
  console.log(SEPARATOR);
  console.log(safeRewrite);
  console.log("");
  console.log(SEPARATOR);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    while (true) {
      const answer = await new Promise<string | null>((resolve) => {
        let answered = false;

        rl.question("Do you approve this rewrite? (approve/reject): ", (input) => {
          answered = true;
          resolve(input);
        });

        // Handle EOF (e.g. piped input ends, stdin closed)
        rl.once("close", () => {
          if (!answered) resolve(null);
        });
      });

      // EOF on stdin — no human is present to answer
      if (answer === null) {
        return "abort";
      }

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
