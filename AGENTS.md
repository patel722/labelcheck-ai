# AGENTS.md

## Project Goal

Build a clean, working proof-of-concept for AI-assisted alcohol label verification.

## Priorities

1. Correctness of core label checks
2. Simple user experience
3. Clear validation reasoning
4. Clean TypeScript code
5. Tests for deterministic validators
6. Documentation of assumptions and limitations

## Technical Commands

- Install: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Type check: `npm run typecheck`
- Tests: `npm test`

## Engineering Rules

- Keep AI extraction separate from validation logic.
- Do not let the LLM make final compliance decisions.
- Use deterministic validators for brand, ABV, net contents, and government warning checks.
- Route ambiguous/low-confidence cases to `needs_review`.
- Do not store uploaded images.
- Keep API keys server-side only.
- Reject unsupported custom upload types rather than forwarding arbitrary files to AI providers.
- If AI extraction fails or is unavailable, route the result to `needs_review` instead of failing the label.
- Prefer a working core application over broad incomplete features.

## UX Rules

- Default UI should be simple enough for a nontechnical compliance agent.
- Advanced details should be available but hidden by default.
- Every result should include a plain-English reason.
- Do not call the result an official legal determination.
