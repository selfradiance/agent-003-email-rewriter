// Calls the Claude API to rewrite an email based on a user instruction.

import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are an email rewriter. You will be given an original email and an instruction for how to rewrite it. Return ONLY the rewritten email, nothing else. No preamble, no explanation, just the rewritten email.`;

export async function rewriteEmail(originalEmail: string, instruction: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set in environment");
  }

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Original email:\n${originalEmail}\n\nInstruction:\n${instruction}`,
        },
      ],
    });

    const block = message.content[0];
    if (block.type !== "text") {
      throw new Error("Unexpected response type from Claude API");
    }

    return block.text;
  } catch (err) {
    if (err instanceof Error && err.message === "ANTHROPIC_API_KEY not set in environment") {
      throw err;
    }
    throw new Error(`Claude API call failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
