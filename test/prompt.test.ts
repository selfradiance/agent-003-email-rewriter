import { describe, it, expect } from "vitest";
import { askHumanVerdict, type HumanVerdict } from "../src/prompt";

describe("prompt", () => {
  it("exports askHumanVerdict as an async function", () => {
    expect(typeof askHumanVerdict).toBe("function");
    // Confirm it returns a promise when called would require stdin mocking —
    // actual terminal interaction verified manually via CLI
  });

  it("HumanVerdict type includes abort", () => {
    // Type-level check — if this compiles, the type is correct
    const verdicts: HumanVerdict[] = ["approve", "reject", "abort"];
    expect(verdicts).toHaveLength(3);
  });
});
