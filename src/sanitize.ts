// Strips ANSI/OSC escape sequences and control characters from strings
// to prevent terminal escape sequence injection.

// Matches:
// - ANSI CSI sequences: ESC [ ... final byte
// - OSC sequences: ESC ] ... (terminated by BEL or ST)
// - Other ESC sequences: ESC followed by a single character
// - Remaining C0/C1 control characters (except \n, \r, \t)
const ESCAPE_RE = /\x1b\[[0-9;]*[A-Za-z]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)?|\x1b[^[\]]|[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\x80-\x9f]/g;

export function stripEscapes(input: string): string {
  return input.replace(ESCAPE_RE, "");
}
