import { describe, it, expect } from "vitest";
import { stripEscapes } from "../src/sanitize";

describe("stripEscapes", () => {
  it("returns plain text unchanged", () => {
    expect(stripEscapes("hello world")).toBe("hello world");
  });

  it("preserves newlines, carriage returns, and tabs", () => {
    expect(stripEscapes("line1\nline2\r\n\ttabbed")).toBe("line1\nline2\r\n\ttabbed");
  });

  it("strips ANSI CSI color sequences", () => {
    expect(stripEscapes("\x1b[31mred text\x1b[0m")).toBe("red text");
  });

  it("strips ANSI CSI cursor movement sequences", () => {
    // Move cursor up 5 lines, then clear screen
    expect(stripEscapes("\x1b[5A\x1b[2Jhidden")).toBe("hidden");
  });

  it("strips complex SGR sequences with multiple parameters", () => {
    expect(stripEscapes("\x1b[1;31;42mbold red on green\x1b[0m")).toBe("bold red on green");
  });

  it("strips OSC sequences (e.g. terminal title changes)", () => {
    // OSC to set terminal title, terminated by BEL
    expect(stripEscapes("\x1b]0;evil title\x07safe text")).toBe("safe text");
  });

  it("strips OSC sequences terminated by ST (ESC backslash)", () => {
    expect(stripEscapes("\x1b]8;;http://evil.com\x1b\\click me\x1b]8;;\x1b\\")).toBe("click me");
  });

  it("strips other ESC sequences (e.g. ESC c for terminal reset)", () => {
    expect(stripEscapes("\x1bcresetting terminal")).toBe("resetting terminal");
  });

  it("strips C0 control characters except newline, carriage return, tab", () => {
    // BEL, BS, VT, FF, and other control chars
    expect(stripEscapes("a\x07b\x08c\x0bd\x0ce")).toBe("abcde");
  });

  it("strips DEL character (0x7f)", () => {
    expect(stripEscapes("abc\x7fdef")).toBe("abcdef");
  });

  it("strips C1 control characters (0x80-0x9f)", () => {
    expect(stripEscapes("test\x90data\x9cmore")).toBe("testdatamore");
  });

  it("handles a realistic injection attack: fake approval prompt", () => {
    // An attacker email could contain escape sequences that clear the screen
    // and print a fake "APPROVED" message
    const malicious = "\x1b[2J\x1b[H\x1b[32m✓ APPROVED — bond released\x1b[0m";
    const cleaned = stripEscapes(malicious);
    expect(cleaned).not.toContain("\x1b");
    expect(cleaned).toBe("✓ APPROVED — bond released");
  });

  it("handles empty string", () => {
    expect(stripEscapes("")).toBe("");
  });

  it("handles string with only escape sequences", () => {
    expect(stripEscapes("\x1b[31m\x1b[0m")).toBe("");
  });
});
