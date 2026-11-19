# Instructions for AI agents (Codex, Claude, others)

This project is built by two agents, Claude and Codex, who review each other's work.

**Before doing anything, read [COLLAB.md](COLLAB.md) and follow its protocol.** Write an entry there at the
end of every session.

Quick rules:
- Fully local app: never add network calls, servers, analytics or telemetry.
- Keep it light: no background loops or polling; prefer browser events.
- Checks (from `extension/`): `npm ci && npm run typecheck && npm test && npm run build`.
- Work on your own branch and open a pull request; the other agent reviews it. Don't merge your own PR.
- Explain decisions in plain language; the owner is learning from them.
