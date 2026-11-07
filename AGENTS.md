# AGENTS.md

Shared project context for AI coding agents and contributors. Keep this file current as the project evolves, and keep it free of personal information (this repo is public).

## Project
Mi Ba Bot (מי בא?) is a configurable Telegram bot. It collects group members' weekly availability and matches it against sessions proposed by an organizer, so people can book quickly. Behavior is driven by per-group configuration, never hardcoded. The first use case (a tennis training group with a coach) is the reference preset, but nothing in the data model may be tennis-specific.

## Status
Spec approved (`docs/SPEC.md`). Stack chosen: TypeScript + grammY on Cloudflare Workers with D1. Technical plan drafted in `docs/PLAN.md`, awaiting approval. Work happens in three phases: product spec (`docs/SPEC.md`), technical plan (`docs/PLAN.md`), then implementation one small PR per plan step. See `docs/KICKOFF.md` for the full vision.

## Conventions
- **Language:** all user-facing bot text is Hebrew and lives in one centralized messages/locale module. Code, comments, commits, PRs and docs are English.
- **Defaults:** timezone Asia/Jerusalem, week starts Sunday, both configurable per group.
- **Git:** never push directly to `main`. Every change goes through a branch and a PR.
- **Commits and PRs:** English, conventional prefixes (`docs:`, `feat:`, `fix:`, `chore:`, `test:`).
- **PRs:** small and independently mergeable. The description explains what changed, why, key concepts introduced, how to test, and what to check in review.
- **Secrets:** never commit tokens or credentials. Use gitignored `.env` locally and the host's secret storage for deployment.
- **Tests:** cover matching, slot/time/timezone handling, booking rules and config validation.
- **Privacy:** no personal information in the repo. Personal context goes in `CLAUDE.local.md`, which is gitignored.
- **Spec changes:** if implementation reveals the spec must change, propose it, update `docs/SPEC.md` after agreement, then continue.
