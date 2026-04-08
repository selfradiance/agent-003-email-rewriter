# Agent 003: Bonded Email Rewriter

A bonded email rewriter that calls the Claude API to rewrite an email, posts a bond through AgentGate, and presents the result to a human for judgment. Approve = bond released. Reject = bond slashed.

## Why This Exists

AI agents can rewrite your emails, but you have no recourse if the result is bad. The agent faces no consequence for producing garbage. Agent 003 changes that: the agent posts collateral before it acts, a human judges the result, and the bond is settled based on that judgment.

This is the third agent in the AgentGate ecosystem. It proves the architectural unlock that makes AgentGate applicable to any task — not just deterministic ones. There's no hash, no script. Just a person deciding.

## How It Relates to AgentGate

[AgentGate](https://github.com/selfradiance/agentgate) is the enforcement substrate. Agent 003 calls AgentGate's API to register an identity, lock a bond, execute a bonded action, and resolve based on the human's approve/reject verdict. AgentGate handles bonding and settlement. Agent 003 handles the LLM call and the human interaction.

AgentGate must be running for Agent 003 to work.

## What's Implemented

- CLI accepting an email file and a rewrite instruction
- Claude API integration for email rewriting
- Side-by-side display of original and rewritten email in terminal
- Human approve/reject prompt
- Full AgentGate lifecycle: identity → bond → execute → human verdict → resolve
- Ed25519 signed requests

## Quick Start

```bash
# 1. Start AgentGate
cd ~/Desktop/projects/agentgate && npm run restart

# 2. Run Agent 003
cd ~/Desktop/projects/agent-003-email-rewriter
cp .env.example .env  # add AGENTGATE_REST_KEY and ANTHROPIC_API_KEY
npm install
npx tsx src/cli.ts examples/sample-email.txt "make this more professional"
```

## Example

You have a casual email you need to send to a client. You run Agent 003 with the instruction "make this more professional." The agent calls Claude to rewrite it, posts a bond on AgentGate, and shows you both versions side by side. You read the rewrite and type `approve` — the bond is released. If the rewrite was bad, you type `reject` — the bond is slashed.

## Scope / Non-Goals

- CLI only — no web UI
- Single email per invocation
- No identity persistence across runs
- No automated LLM output evaluation — the human is the verifier
- No MCP server

## Tests

11 tests covering rewriter logic, CLI flow, and AgentGate integration mocking.

```bash
npm test
```

## Related Projects

- [AgentGate](https://github.com/selfradiance/agentgate) — the core execution engine
- [Agent 001: Bonded File Transform](https://github.com/selfradiance/agentgate-bonded-file-transform) — deterministic verification
- [Agent 002: File Guardian](https://github.com/selfradiance/agentgate-bonded-file-guardian) — command-based verification
- [Agent 004: Red Team Simulator](https://github.com/selfradiance/agentgate-red-team-simulator) — adversarial testing

## Status

Complete — v0.1.0 shipped. 8-round Claude Code audit. 11 tests.

## License

MIT
