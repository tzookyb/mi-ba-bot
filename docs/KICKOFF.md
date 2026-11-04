# Project: "Mi Ba?" (מי בא?) — A Configurable Group Availability & Session-Matching Bot for Telegram

## Context
Groups that run sessions with an organizer usually coordinate ad-hoc in a group chat: the organizer asks "anyone want to join tomorrow?", and then there is a lot of back-and-forth and waiting for replies. It creates friction, and the organizer wastes time chasing people.

This is a common problem far beyond tennis: any group where an **organizer** offers **sessions** and **participants** need to respond quickly (sports training, a weekly poker night, band rehearsals, study groups, a padel/football pickup game, a babysitting co-op, etc.).

So I want to build **Mi Ba Bot** (`@MiBaBot` or similar): a generic, **configurable** Telegram bot that any group can add and set up with its own rules. **A tennis training group with a coach is the first use case and the reference configuration**, but the product and the data model must not be tennis-specific.

### The core idea (my initial vision — to be refined with you)
- On a configurable schedule (e.g. every Sunday), the bot asks each member to mark the time slots they're available.
- Anytime, members can easily update their availability (plans change).
- When an organizer has an opening, they tell the bot (e.g. "session tomorrow 19:00").
- The bot checks the proposed session against members' availability:
  - If there are matches → it tags the relevant members in the group (and/or DMs them): "Alex, Sam — there's a session tomorrow evening and you marked you're available. Are you in?" — with quick-reply buttons to book fast.
  - If nobody is available → it tells the organizer privately, and (depending on config) still posts in the group so anyone whose plans changed can jump in.
- Goal: fast answers from participants, less waiting and chasing for the organizer.

### Extensibility — the key design principle
Every group can configure how the bot behaves for them. Behavior is driven by a **per-group configuration**, not hardcoded logic. Examples of what should be configurable (to be finalized in Phase 1):
- **Availability model** — slot definitions (named slots like morning/noon/evening with time ranges, or hourly), which days are active, recurring defaults per member.
- **Cadence** — when and how often the availability prompt is sent (weekly/bi-weekly/never), reminder timing for non-responders, week start day, timezone.
- **Roles** — who can propose sessions (one organizer, several, anyone), who can change settings (admins).
- **Booking rules** — min/max participants, waitlist on/off, response deadline, first-come-first-served vs. organizer picks, whether a session auto-confirms or is auto-cancelled when the minimum isn't reached.
- **Notification policy** — tag in group vs. DM vs. both; whether to post publicly when nobody matched; quiet hours; how "noisy" the bot is.
- **Session fields** — which fields a session has (date, time, duration, location, price, notes) and which are required.
- **Reminders** — e.g. X hours before a confirmed session.
- **Wording** — the session's noun ("אימון" / "משחק" / "חזרה" / "מפגש"), and possibly custom message templates.
- **Presets** — ready-made templates (e.g. "Sports training with coach", "Pickup game", "Weekly meetup") so a new group can be set up in a minute, then tweaked.

Configuration should be done **from within Telegram** by a group admin (e.g. a guided setup wizard with buttons when the bot is first added, plus a settings menu later) — no code changes or redeploys to onboard a new group.

**Important balance:** design the architecture and data model to be multi-group and config-driven from day one, but **don't over-engineer the MVP**. The first milestone should ship our tennis group's configuration end-to-end; additional config options, presets, and the full setup wizard can come in later steps. Flag clearly which config options are v1 vs. later.

### Language
- **All user-facing bot text (messages, buttons, menus) is in Hebrew.** Keep all strings centralized in one place (e.g. a messages/locale module) so they're easy to edit — and so adding other languages later is possible, though not in scope now.
- Code, comments, commit messages, PR descriptions, docs, and our conversation: **English**.
- Default timezone: Asia/Jerusalem. Default week start: Sunday. Both configurable per group.

---

## How I want us to work — three phases. Do NOT skip ahead.

### Phase 1 — Product spec (interview me)
Before writing any code or technical plan, interview me to build a complete, as-final-as-possible product spec, covering the bot's behavior end-to-end, A to Z. Ask questions in small batches (3–6 at a time), grouped by topic, and propose sensible defaults/options for each so I can just pick. For each behavioral question, also ask (or propose) whether it should be **fixed behavior** or a **per-group setting**, and what the default is. Keep going until there are no open questions.

Topics to cover at minimum (add any I missed):
1. **Concepts & terminology** — define the core entities clearly (group, member, role, availability, slot, session/proposal, booking, waitlist, config, preset).
2. **Onboarding** — what happens when the bot is added to a new group; setup wizard flow; how members register (Telegram bots can't DM users who never pressed Start — how do we handle that?); members joining/leaving; a user who is in multiple groups using the bot.
3. **Roles & permissions** — organizer(s), participants, admins; who can change settings.
4. **Availability model** — slot granularity, recurring defaults vs. weekly marking, members who don't respond, the weekly prompt and reminders.
5. **Updating availability anytime** — how (buttons, menu, maybe free text later), and how changes interact with already-proposed sessions.
6. **Proposing a session** — input format (command, guided buttons, free text later); session fields; proposing multiple options at once.
7. **Matching & notifications** — what exactly counts as a "match"; group tag vs. DM; message wording; the "nobody matched" flow.
8. **Booking flow** — in/out buttons, capacity, waitlist, deadlines, what the organizer sees and when, confirmation messages.
9. **Changes & cancellations** — participant drops out (waitlist promotion?), organizer cancels/reschedules, minimum participants.
10. **Reminders & summaries** — pre-session reminders, weekly availability overview for organizers, upcoming sessions list, history.
11. **Configuration system** — full list of settings, their types and defaults, which are v1; presets; the settings UX inside Telegram; validation of settings.
12. **Privacy & noise** — what's public vs. private; data stored about members; data deletion when a member/group leaves.
13. **Edge cases** — holidays, overlapping proposals, the bot being down/restarted, timezones, bot removed from a group.
14. **Abuse & limits** — basic protection if the bot is added to random groups (rate limits, max groups, an allowlist for now?).
15. **Out of scope for v1** — explicitly list what we will NOT build now (e.g. payments, attendance tracking, calendar sync, AI/free-text parsing, other languages, web dashboard).

Also ask me about my own technical background, so you can tune how much you explain.

When done, write the final spec to `docs/SPEC.md` — concise and structured, including:
- the entity glossary
- every user flow with example Hebrew messages
- a **configuration reference table** (setting, type, default, v1/later)
- the **tennis-group preset** as a concrete worked example

Then ask me to approve it explicitly before moving on.

### Phase 2 — Technical plan
After I approve the spec, propose the tech stack and hosting with a short rationale and trade-offs, and let me choose. My preferences: free or near-free hosting, simple to deploy, minimal moving parts. (Options to consider: TypeScript + grammY or Python + python-telegram-bot / aiogram; Cloudflare Workers + D1, Vercel, Fly.io, Supabase, a small VPS; webhooks vs. long-polling; scheduled jobs for per-group prompts and reminders.)

Include a short architecture section: the data model (multi-group from day one), how per-group config is stored, validated (schema), and versioned/migrated, and how scheduled jobs handle many groups with different cadences and timezones.

Then write a detailed, step-by-step implementation plan to `docs/PLAN.md`:
- Break the work into **small, independently mergeable steps** — each one a single PR that I can read and understand in one sitting (ideally a few hundred lines of diff at most).
- Each step must leave the bot in a working, deployable state.
- For each step: goal, files touched, what's tested, how to verify manually, and what I'll learn from it.
- Early steps set up the foundation: repo skeleton, linting/formatting, tests, CI (GitHub Actions), config & secrets handling, a "hello world" bot deployed end-to-end, and the data model.
- Then: the core flows using the tennis config (initially seeded/hardcoded as a preset), then configurability via Telegram, then additional presets and options.
- Include a step for a separate **test bot + test group**, so development never spams the real group.

Ask me to approve the plan before starting.

### Phase 3 — Implementation, one PR at a time
- We'll create a new GitHub repository on my profile (suggested name: `mi-ba-bot`; ask me to confirm the name and public/private before creating it).
- Work strictly **one plan step per branch and PR**. Never push directly to `main`.
- Each PR description should explain: what changed, why, key concepts/libraries/patterns introduced (I'm here to learn), how to test it, and anything I should pay attention to when reviewing.
- After opening a PR, stop and wait for my review. I may ask questions or request changes. Only start the next step after I merge.
- Write tests for logic — especially matching, slot/time/timezone handling, booking rules, and config validation.
- **Secrets**: the bot token and any credentials must never be committed. Use env vars / `.env` (gitignored) locally and the hosting provider's / GitHub's secret storage for deployment. Never ask me to paste secrets into chat — tell me where to put them myself.
- Keep `docs/PLAN.md` updated with progress (check off completed steps), and maintain a `CLAUDE.md` with project conventions so future sessions have context.
- If during implementation we discover the spec needs to change, stop, propose the change, update `docs/SPEC.md` after I agree, then continue.

Start now with Phase 1: briefly confirm you understand the project and the process, then ask your first batch of questions.