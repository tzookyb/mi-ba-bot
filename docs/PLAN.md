# Mi Ba Bot — Technical Plan

Status: **approved**. Implements [SPEC.md](SPEC.md). Each step below is one branch and one PR. Check a step off here in the same PR that finishes it.

## 1. Stack

| Part | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) | Matches the owner's background. |
| Bot framework | [grammY](https://grammy.dev) | Modern TS-first Telegram framework, runs on Cloudflare Workers, good docs, plugins for menus and sessions. |
| Hosting | Cloudflare Workers (free plan) | No server to keep alive. Telegram calls us (webhook); Cron Triggers run our timer. One-command deploy. |
| Database | Cloudflare D1 (SQLite) | Free, lives next to the Worker, plain SQL. |
| DB access + migrations | Drizzle ORM + drizzle-kit | Typed queries; generates SQL migration files that `wrangler d1 migrations apply` runs. |
| Validation | Zod | One schema gives both runtime validation and the TS type for group config. |
| Dates / timezones | Luxon | Mature, IANA timezones via `Intl`, DST-safe arithmetic. |
| Lint + format | Biome | One fast tool instead of ESLint + Prettier. |
| Tests | Vitest + `@cloudflare/vitest-pool-workers` | Tests run inside the real Workers runtime with a local D1. |
| CI / CD | GitHub Actions | Lint, typecheck and test on every PR; deploy on merge. |

**Trade-offs we accept:** Workers are not full Node (some npm packages won't run). The free plan limits each invocation to about 10 ms of CPU time (waiting on network doesn't count) and about 50 outgoing requests, so big fan-outs (the weekly prompt to many members) are split across timer runs. Check current limits in the Cloudflare docs before relying on exact numbers.

## 2. Architecture

```
Telegram ──HTTPS webhook──▶ Worker fetch()  ──▶ grammY bot ──▶ handlers ──▶ D1
                                                                 │
Cloudflare Cron (every minute) ──▶ Worker scheduled() ──▶ job runner ──▶ Telegram API
```

- **One Worker, two entry points.** `fetch()` receives Telegram updates on a secret webhook path and checks Telegram's `X-Telegram-Bot-Api-Secret-Token` header. `scheduled()` runs every minute and executes due jobs.
- **Stateless.** Nothing is kept in memory between requests. Multi-step button flows (availability, propose, settings) keep their state in a D1 table keyed by user.
- **Layers** (folders under `src/`):
  - `domain/`: pure logic, no I/O (time, matching, booking rules, config). Most tests live here.
  - `db/`: Drizzle schema and small repository functions.
  - `bot/`: grammY handlers, keyboards, flows. Thin: parse input, call domain, render messages.
  - `jobs/`: the scheduler and one handler per job kind.
  - `messages/he.ts`: every Hebrew string, as functions (so gender and plural agreement is in one place).
- **Two environments.** `dev` (test bot, test group, own D1) and `prod` (real bot, own D1), as wrangler environments. Development never touches the real group.

### 2.1 Data model (multi-group from day one)

| Table | Key columns | Notes |
|---|---|---|
| `users` | `tg_user_id` PK, `first_name`, `last_name`, `username`, `registered_at` | `registered_at` set when they press Start (can receive DMs). |
| `groups` | `id` PK, `tg_chat_id` unique, `title`, `status` (`pending`/`approved`/`removed`), `removed_at`, `config` JSON, `config_version` | `status` is the allowlist. |
| `memberships` | (`group_id`, `user_id`) PK, `is_organizer`, `joined_at` | Row deleted when they leave the group. |
| `availability` | `id`, `group_id`, `user_id`, `date` (local), `start_min`, `end_min`, `slot_name` nullable | Local wall-clock minutes, not UTC: slots are wall-clock, so DST can't shift them. |
| `weekly_responses` | (`group_id`, `user_id`, `week_start`) PK, `responded_at`, `none_this_week` | Who answered the weekly prompt (drives the reminder). |
| `sessions` | `id`, `group_id`, `organizer_id`, `start_at`, `end_at` (UTC), `deadline_at`, `location`, `notes`, `status` (`open`/`set`/`canceled`), `organizer_participates`, `min`, `max`, `tg_message_id` | `min`/`max` copied at post time, so later config changes don't affect it. |
| `bookings` | (`session_id`, `user_id`) PK, `status` (`in`/`out`), `updated_at` | |
| `jobs` | `id`, `kind`, `group_id`, `run_at` (UTC), `payload` JSON, `status`, `attempts` | The scheduler queue (2.3). |
| `flow_state` | (`user_id`, `chat_id`) PK, `flow`, `state` JSON, `updated_at` | State of a multi-step button flow. |

The operator (who approves groups) is a Telegram user id in a secret env var, not a DB row.

### 2.2 Group config

- Stored as one JSON column on `groups`, plus `config_version`.
- `src/domain/config/schema.ts` defines `GroupConfigSchema` with Zod. `type GroupConfig = z.infer<typeof GroupConfigSchema>` gives the TS type for free. Cross-field rules (`min ≤ max`, slot end after start, slots inside opening hours) are Zod `refine`s that return Hebrew-ready error codes.
- **Defaults and presets:** `DEFAULT_CONFIG` holds SPEC section 7 defaults. A preset is a partial override (`TENNIS_PRESET`), merged over the defaults and then validated.
- **Versioning:** when the shape changes, bump the version and add a pure `migrate_vN_to_vN+1(old)` function. On read, the config is upgraded step by step and written back. Each migration has a test.

### 2.3 Scheduled jobs (many groups, many timezones)

- One cron trigger runs every minute. It picks up to N due jobs (`run_at <= now`, `status = pending`), runs them, and marks them done.
- **Recurring jobs** (the weekly prompt): after it runs, the handler computes the next occurrence in the group's timezone with Luxon (e.g. "next Saturday 20:00 Asia/Jerusalem"), converts it to UTC, and inserts the next job. DST is handled because we compute in local time and convert.
- **One-off jobs** (deadline, set check, pre-session reminder, non-responder reminder, data purge) are inserted when their event happens and canceled when the session is canceled.
- **Quiet hours:** a job that sends DMs and is due inside quiet hours is moved to the end of quiet hours.
- **Missed jobs:** if the bot was down and a job is more than 3 h late, it's skipped (marked `stale`), per SPEC 5.12.
- **Fan-out:** a job that must message many people (weekly prompt) sends a chunk, saves a cursor in its payload, and reschedules itself for the next minute. This stays inside the free-plan limits.
- **Idempotency:** a job is claimed with a conditional update (`pending → running`), so two overlapping runs can't send twice.

### 2.4 Secrets and config

- Secrets: `BOT_TOKEN`, `WEBHOOK_SECRET`, `OPERATOR_TG_ID`. Locally in `.dev.vars` (gitignored); deployed with `wrangler secret put`, per environment. CI deploy uses a `CLOUDFLARE_API_TOKEN` GitHub secret.
- Non-secret settings (D1 binding, cron schedule, env names) live in `wrangler.toml`.
- `.dev.vars.example` lists the variable names with no values.

### 2.5 Local development

- `npm run dev` runs `wrangler dev` with a local D1.
- To receive real Telegram updates locally, a quick Cloudflare tunnel (`cloudflared tunnel --url`) gives a public URL, and `npm run set-webhook` points the **test** bot at it.
- Unit tests need none of this: `npm test` runs everything offline.

## 3. Steps

Legend: **Goal**, **Files**, **Tests**, **Verify** (by hand), **Learn**. Every step leaves `main` deployable.

### Foundation

- [x] **1. Repo skeleton**
  - Goal: TypeScript project with Biome, Vitest and a first pure function.
  - Files: `package.json`, `tsconfig.json`, `biome.json`, `.nvmrc`, `src/domain/time/weekday.ts`, its test, `.gitignore` (+ `.dev.vars`, `.wrangler/`).
  - Tests: one small unit test.
  - Verify: `npm ci && npm run lint && npm run typecheck && npm test`.
  - Learn: project tooling, strict TS settings, Biome.

- [x] **2. CI**
  - Goal: GitHub Actions runs lint, typecheck and tests on every PR.
  - Files: `.github/workflows/ci.yml`.
  - Verify: the PR itself shows a green check. Optional: protect `main` so CI must pass.
  - Learn: Actions workflows, caching npm.

- [x] **3. Hello Worker**
  - Goal: a Worker that answers `GET /health` with `ok`, deployed to Cloudflare by hand.
  - Files: `wrangler.toml`, `src/index.ts`, test using the Workers pool.
  - Verify: `npm run dev` then open `/health`; `npx wrangler deploy --env dev` and open the `*.workers.dev` URL.
  - Learn: the Workers model (`fetch` handler, bindings, environments), wrangler.

- [ ] **4. Test bot + test group, hello bot**
  - Goal: a dev bot answers `/start` with a Hebrew hello, through the webhook.
  - Files: `docs/DEV.md` (BotFather steps, test group, tunnel, secrets), `.dev.vars.example`, `src/bot/index.ts`, `src/messages/he.ts`, `scripts/set-webhook.ts`.
  - Tests: webhook rejects a wrong secret header; `/start` handler replies (Telegram API mocked).
  - Verify: create the test bot and test group (you do this, I write the steps). DM the bot `/start`.
  - Learn: webhooks vs long polling, grammY on Workers (`webhookCallback`, preset `botInfo`), secret handling.

- [ ] **5. Deploy pipeline**
  - Goal: merging to `main` deploys to `dev` automatically; `prod` deploy is a manual button.
  - Files: `.github/workflows/deploy.yml`.
  - Verify: merge, watch the action, bot still answers.
  - Learn: CD, GitHub environments and secrets.

- [ ] **6. Database and first tables**
  - Goal: D1 + Drizzle with `users`, `groups`, `memberships`; first migration.
  - Files: `src/db/schema.ts`, `src/db/repo/*.ts`, `drizzle.config.ts`, `migrations/0001_*.sql`.
  - Tests: repository functions against a local D1.
  - Verify: `npm run db:migrate:local`, inspect with `wrangler d1 execute`.
  - Learn: D1, Drizzle schema and migrations, why migrations are files in git.

- [ ] **7. Group config schema and the tennis preset**
  - Goal: `GroupConfigSchema`, defaults, `TENNIS_PRESET`, the version-migration skeleton.
  - Files: `src/domain/config/{schema,defaults,presets,migrate}.ts` + tests.
  - Tests: valid/invalid configs, every cross-field rule, preset merge, a dummy v0→v1 migration.
  - Learn: Zod, deriving types from schemas, config versioning.

### Core flows (tennis preset)

- [ ] **8. Group lifecycle and allowlist**
  - Goal: bot added → `pending`, operator gets a DM with Approve/Reject buttons; approved → welcome + tennis preset applied; not approved → polite message and leave; bot removed → `removed`.
  - Files: `src/bot/handlers/group-lifecycle.ts`, `src/bot/handlers/operator.ts`, messages.
  - Tests: each transition with fake updates.
  - Verify: add the dev bot to the test group, approve it from your DM.
  - Learn: Telegram `my_chat_member` updates, callback buttons, inline keyboards.

- [ ] **9. Registration and membership**
  - Goal: join button with deep link, `/start g_<id>`, `/join`, welcome for new members, leaving removes the membership; tapping a second group's button links it.
  - Files: `src/bot/handlers/registration.ts`, `src/domain/deeplink.ts`.
  - Tests: deep-link parsing, membership create/delete, already-registered case.
  - Verify: a second Telegram account joins the test group and registers.
  - Learn: deep links, privacy mode, what bots can and can't see.

- [ ] **10. Time engine**
  - Goal: pure functions for weeks (week start day, tz), slots clipped to opening hours, granularity steps, local ↔ UTC.
  - Files: `src/domain/time/*.ts`.
  - Tests: heavy, including DST change weeks, Saturday short hours, week boundaries, sessions near midnight.
  - Learn: wall-clock vs instant time, Luxon, why DST bugs happen.

- [ ] **11. Availability storage and matching**
  - Goal: `availability` + `weekly_responses` tables; pure `matchSession(session, availabilities) → {matches, maybes}`.
  - Files: `src/domain/matching.ts`, `src/db/repo/availability.ts`, migration.
  - Tests: full cover, partial overlap, touching edges, no availability, "not available this week", organizer excluded.
  - Learn: interval logic, keeping core logic pure and testable.

- [ ] **12. Availability UI: slots**
  - Goal: `/my` and the post-registration flow: week grid, slot toggles, "same as last week", "not available this week", done.
  - Files: `src/bot/flows/availability.ts`, `src/db/repo/flow-state.ts`, `flow_state` migration, keyboards.
  - Tests: flow state transitions; keyboard rendering.
  - Verify: mark availability on the test bot, check the DB.
  - Learn: stateless multi-step flows, editing messages in place, callback data size limits (64 bytes).

- [ ] **13. Availability UI: exact hours and multi-group**
  - Goal: start/end pickers in granularity steps; "apply to all my groups / only this one".
  - Tests: picker bounds, apply-to-all writes.
  - Learn: designing compact button UIs.

- [ ] **14. Propose flow**
  - Goal: private `/propose` wizard (day, start, duration, location, notes, deadline, "גם אני משתתף/ת"), preview with matches/maybes, overlap warning. Ends at a confirmed draft (not posted yet).
  - Files: `src/bot/flows/propose.ts`, `sessions` migration, `src/domain/sessions.ts`.
  - Tests: deadline defaults (incl. session sooner than 2 h), overlap detection, permission check (`organizerMode`).
  - Learn: reusing the flow pattern; permission checks.

- [ ] **15. Group post and booking**
  - Goal: publish to the group with tags, live-updating "באים" list, אני בא / לא הפעם toggle, max = full, no-match handling (organizer DM + optional untagged post); "set" announcement when min is reached.
  - Files: `src/bot/handlers/booking.ts`, `src/domain/booking.ts`, `bookings` migration, messages.
  - Tests: booking rules (toggle, undo before set, no self-removal after set, max, min reached once), mention rendering for users without username.
  - Verify: propose in DM, tap from two accounts in the test group.
  - Learn: message editing, user mentions, avoiding race conditions with conditional updates.

### Timers

- [ ] **16. Scheduler foundation**
  - Goal: cron trigger, `jobs` table, runner with claiming, quiet-hours shift, staleness skip, fan-out cursor.
  - Files: `src/jobs/runner.ts`, `src/jobs/registry.ts`, migration, `wrangler.toml` cron.
  - Tests: with a fake clock: due vs not due, quiet hours, stale, double-run safety.
  - Learn: Cron Triggers, job queues on a database, idempotency.

- [ ] **17. Session jobs**
  - Goal: deadline job (ask organizer: cancel / keep anyway / extend 1 h), pre-session reminder.
  - Tests: job creation on post, cancel on session cancel, extend reschedules.
  - Learn: event-driven scheduling.

- [ ] **18. Manage sessions**
  - Goal: `/sessions` list, cancel (edit post + tag reply), organizer removes a participant (+ below-min prompt), buttons on past sessions answer "already started".
  - Tests: cancel effects, removal and min check.

- [ ] **19. Weekly prompt and reminder**
  - Goal: recurring per-group weekly prompt (DM + short group post), non-responder reminder after N hours.
  - Tests: next-occurrence computation across DST, who counts as "didn't answer", chunked fan-out.
  - Verify: set the test group's prompt to a few minutes from now.
  - Learn: recurring jobs per timezone.

- [ ] **20. Overview**
  - Goal: `/overview` grid (count per slot per day), tap for names and "propose here" (pre-fills step 14 flow); respects `overviewVisibility`.
  - Tests: aggregation, visibility check.

### Configuration in Telegram

- [ ] **21. /setup**
  - Goal: admin-only short setup: preset → noun (+plural, gender) → slots and hours → min/max → organizer mode. Replaces the auto-applied preset from step 8.
  - Tests: admin check, each step validates through the schema.
  - Learn: checking Telegram admin status, validation messages in Hebrew.

- [ ] **22. /settings, part 1: wording, schedule, sessions**
- [ ] **23. /settings, part 2: people and notifications** (organizer list, overview visibility, weekly prompt, reminders, quiet hours, DMs, no-match post, `organizerCountsByDefault`)
  - Tests: every setting round-trips through validation; invalid input rejected with a clear message.

### Privacy and launch

- [ ] **24. Privacy**
  - Goal: `/forget` with confirm; purge job 30 days after the bot is removed (canceled if re-added).
  - Tests: everything about the user is gone; re-add within 30 days restores.

- [ ] **25. Production launch**
  - Goal: prod bot, prod D1, secrets, webhook; approve the real group; `docs/OPERATIONS.md` (deploy, rollback, approving groups, reading logs).
  - Verify: end-to-end week in the real group.

### Later (not planned in detail)

More presets and the full wizard, several session types, waitlist, several time options per proposal, repeating sessions, free-text input, opening the bot to everyone with limits.
