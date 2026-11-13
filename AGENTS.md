# AGENTS.md

Shared project context for AI coding agents and contributors. Keep this file current as the project evolves, and keep it free of personal information (this repo is public).

## Project
Mi Ba Bot (מי בא?) is a configurable Telegram bot. It collects group members' weekly availability and matches it against sessions proposed by an organizer, so people can book quickly. Behavior is driven by per-group configuration, never hardcoded. The first use case (a tennis training group with a coach) is the reference preset, but nothing in the data model may be tennis-specific.

## Status
Spec approved (`docs/SPEC.md`). Stack chosen: TypeScript + grammY on Cloudflare Workers with D1. Plan approved (`docs/PLAN.md`); implementing it one step per PR, progress is checked off there. Work happens in three phases: product spec (`docs/SPEC.md`), technical plan (`docs/PLAN.md`), then implementation one small PR per plan step. See `docs/KICKOFF.md` for the full vision.

## Commands
- `npm ci`: install exact dependency versions from `package-lock.json`.
- `npm run lint` / `npm run format`: Biome check / auto-fix (Markdown is excluded).
- `npm run typecheck`: TypeScript, no output files.
- `npm test`: Vitest. Tests sit next to the code as `*.test.ts`.
- `npm run dev`: run the Worker locally with Wrangler (http://localhost:8787/health).
- `npm run deploy:dev`: deploy the `dev` environment to Cloudflare (needs `npx wrangler login` once).
- `npm run cf-typegen`: regenerate `worker-configuration.d.ts` (the `Env` and runtime types) after changing `wrangler.toml` or `.dev.vars.example` (secret names come from that file, never from `.dev.vars`). The file is generated and committed; don't edit it by hand.
- `npm run set-webhook -- <worker URL>`: point the dev bot's webhook at a Worker. Full dev setup (test bot, secrets, tunnel) is in `docs/DEV.md`.
- Tests run inside the Workers runtime through `@cloudflare/vitest-plugin`; call the Worker with `exports.default.fetch()` from `cloudflare:workers`.
- CI (`.github/workflows/ci.yml`) runs lint, typecheck and tests on every PR and on `main`. Keep it green before asking for review.

## Conventions
- **Language:** all user-facing bot text is Hebrew and lives in one centralized messages/locale module. Code, comments, commits, PRs and docs are English.
- **Defaults:** timezone Asia/Jerusalem, week starts Sunday, both configurable per group.
- **Git:** never push directly to `main`. Every change goes through a branch and a PR.
- **Commits and PRs:** English, conventional prefixes (`docs:`, `feat:`, `fix:`, `chore:`, `test:`).
- **PRs:** small and independently mergeable. The description explains what changed, why, key concepts introduced, how to test, and what to check in review.
- **Secrets:** never commit tokens or credentials. Use gitignored `.dev.vars` locally (template: `.dev.vars.example`) and the host's secret storage for deployment.
- **Tests:** cover matching, slot/time/timezone handling, booking rules and config validation.
- **Privacy:** no personal information in the repo. Personal context goes in `CLAUDE.local.md`, which is gitignored.
- **Spec changes:** if implementation reveals the spec must change, propose it, update `docs/SPEC.md` after agreement, then continue.
