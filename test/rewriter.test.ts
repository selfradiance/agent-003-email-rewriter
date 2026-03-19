import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rewriteEmail } from "../src/rewriter";

describe("rewriteEmail", () => {
  it("throws if ANTHROPIC_API_KEY is not set", async () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    await expect(
      rewriteEmail("hello", "make it formal"),
    ).rejects.toThrow("ANTHROPIC_API_KEY not set in environment");

    // Restore
    if (saved) process.env.ANTHROPIC_API_KEY = saved;
  });
});

const HAS_KEY = !!process.env.ANTHROPIC_API_KEY;

describe.skipIf(!HAS_KEY)("rewriteEmail — live API", () => {
  it("rewrites an email via Claude API", async () => {
    const original = "hey bob, can u send me the report asap?? thx";
    const result = await rewriteEmail(original, "make this more professional");

    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toBe(original);
  }, 15000); // allow 15s for API call
});
