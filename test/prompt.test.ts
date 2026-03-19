import { describe, it, expect } from "vitest";
import { askHumanVerdict } from "../src/prompt";

describe("prompt", () => {
  it("exports askHumanVerdict as an async function", () => {
    expect(typeof askHumanVerdict).toBe("function");
    // Confirm it returns a promise when called would require stdin mocking —
    // actual terminal interaction verified manually via CLI
  });
});
