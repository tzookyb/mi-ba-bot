# Mi Ba Bot — Product Spec (v1)

Status: **draft, awaiting approval** (no open questions left). This is the result of the Phase 1 interview (see [KICKOFF.md](KICKOFF.md)). Once approved it is the source of truth for behavior; changes go through a PR that updates this file.

## 1. Summary

Mi Ba Bot (מי בא?) is a Telegram bot that a group adds to its group chat. Members tell the bot when they are free each week. When an organizer proposes a session, the bot posts it in the group, tags the members who are free at that time, and lets everyone answer with one tap. The organizer sees who is in without chasing anyone.

Everything that differs between groups (slots, opening hours, roles, minimums, wording, timing) is a **per-group setting**. The tennis training group with a coach is the reference preset (section 8), but nothing in the product is tennis-specific.

## 2. Glossary

| Term | Meaning |
|---|---|
| **Group** | A Telegram group chat that added the bot and was approved. Holds one config. |
| **Member** | A Telegram user known to the bot in a specific group. The same person in two groups is two memberships, with separate availability. |
| **Registered member** | A member who pressed Start in a private chat with the bot. Only registered members can get private messages. |
| **Role** | What a member may do in a group: *participant* (everyone), *organizer* (may propose sessions), *admin* (may change settings; = the group's Telegram admins). |
| **Slot** | A named time window defined by the group, e.g. ערב = 16:00–22:00. Used for quick availability marking. |
| **Opening hours** | Per-weekday window in which sessions can happen (e.g. Sat 07:00–20:00). Slots and exact hours are clipped to it. |
| **Availability** | A member's free time windows for a given week in a given group. Entered as whole slots or exact hours. |
| **Week** | Starts on the group's week start day (default Sunday) in the group's timezone. |
| **Session** | One proposed meeting: date, start, duration, optional location and notes. Called by the group's *noun* (אימון / משחק / מפגש ...). |
| **Match** | A member whose availability fully covers the session time. |
| **Maybe** | A member whose availability overlaps only part of the session time. |
| **Booking** | A member's answer to a session: *in* (אני בא) or *out* (לא הפעם). |
| **Deadline** | The time until which the session waits to reach its minimum. |
| **Set (נקבע)** | A session that reached its minimum participants. Others can still join afterwards (up to max, if any). |
| **Config** | All settings of one group (section 7). |
| **Preset** | A ready-made config a group starts from, then tweaks. v1 ships one: tennis training with a coach. |
| **Allowlist** | The list of groups the bot operator approved. The bot works only in those (v1). |

## 3. Roles and permissions

| Action | Who |
|---|---|
| Mark / update own availability | Any member |
| Answer a session (in / out, undo) | Any member (registered or not) |
| Propose, cancel a session; remove someone from a session | Organizers (setting: closed list, or everyone) |
| See the availability overview | Setting: organizers only, or all participants |
| Run /setup, change /settings, manage the organizer list | Telegram group admins |
| Approve a group (allowlist) | The bot operator only |

The organizer who proposes a session is not tagged as a match for their own session. Whether they count toward the minimum is chosen per proposal with a "גם אני משתתף/ת" (I'm taking part too) toggle; its starting value is the group setting `organizerCountsByDefault` (tennis: off, since the coach isn't a player).

## 4. How people talk to the bot

The bot runs in Telegram **privacy mode**: it does not read normal group chat. In a group it only sees commands (`/sessions`, or `/sessions@MiBaBot`), messages that mention it, replies to its messages, and taps on its buttons. Longer flows (availability, proposing, settings) happen in the **private chat** with the bot, so the group only sees short final posts.

Commands (v1):

| Command | Where | What |
|---|---|---|
| `/start` | private | Register; opened from a group's join button it links you to that group |
| `/join` | group | Posts the join button again |
| `/my` | private | Mark / edit my availability |
| `/propose` | private | Propose a session (organizers) |
| `/overview` | private | Week overview of everyone's availability (if allowed) |
| `/sessions` | group or private | Upcoming sessions and who is in |
| `/setup` | group | First-time setup (admins) |
| `/settings` | group → opens private | Settings menu (admins) |
| `/forget` | private | Delete my data |
| `/help` | anywhere | Short help |

All user-facing text is Hebrew and lives in one messages module. Example messages below are drafts; final wording is tuned during implementation.

## 5. User flows

### 5.1 Bot is added to a group

1. Someone adds the bot. If the group is **not on the allowlist**, the bot posts `הבוט עדיין פרטי ולא זמין לקבוצות חדשות. מצטערים!` and leaves. The operator is notified privately with the group name and id so they can approve it.
2. If the group is approved, the bot posts a welcome and asks an admin to run `/setup`:
   > שלום! אני מי בא? 🎾 אני עוזר לתאם אימונים לפי הזמינות של כולם. מנהל/ת הקבוצה, הקלידו /setup כדי להתחיל.
3. **/setup** (admins, buttons in private chat): pick a preset (v1: only one) → confirm the noun (+ plural + gender) → slots and opening hours → min / max participants → who can organize (everyone, or pick people) → done. Everything else uses preset defaults and can be changed later in `/settings`.
4. The bot posts the join message in the group (and asks admins to pin it):
   > כדי שאדע מתי אתם פנויים, לחצו על הכפתור ואז על Start 👇
   > [הצטרפות]

### 5.2 Member registration and joining

1. A member taps **הצטרפות**. Telegram opens a private chat with the bot (a deep link that carries the group id). They tap **Start** (once, ever).
2. Bot: `נרשמת לקבוצה "<group name>" ✅ בוא/י נסמן מתי את/ה פנוי/ה השבוע.` → goes to the availability flow (5.3).
3. **Joining the group later:** when the bot sees a new member join, it posts one short welcome with the same button. `/join` re-posts it any time.
4. **Never pressed Start:** the member can still be tagged and can still tap in/out on group posts (this creates their membership). They just get no private messages, and the bot nudges them once to register.
5. **Leaving the group:** the bot removes that membership and its availability. Past bookings are kept only as anonymous counts.
6. **Already registered, another group:** tapping a second group's join button just links the new group; no second Start needed.

### 5.3 Marking availability

Private chat, buttons only:

1. Bot shows the week: one row per active day (inside opening hours), with the slot buttons, e.g. `ה׳ 13.11: [בוקר] [צהריים] [ערב] [שעות מדויקות]`. Tap toggles a slot (✅).
2. **Exact hours:** pick a start and end time in steps of the group's time granularity (e.g. 30 min), within opening hours. Example: Fri 15:00–18:00.
3. Shortcuts: `[כמו שבוע שעבר]` (same as last week), `[לא פנוי השבוע]` (not available this week), `[סיום]`.
4. **Several groups:** if the member is in more than one group, after saving the bot asks: `לעדכן את זה גם בקבוצות האחרות שלך? [כל הקבוצות] [רק בקבוצה הזו]`.
5. **Update any time:** `/my` reopens the same screen for this week or next week. Changes take effect on the next proposal. They don't change bookings on sessions already posted (people answer those with the buttons).
6. **No answer this week:** last week's availability is carried over as this week's. A member who never submitted has no availability and is never tagged (they still see group posts).

### 5.4 Weekly prompt and reminder

- At the configured time (default: Saturday 20:00, the evening before the week starts), the bot sends each registered member a private message:
  > שבוע חדש מתחיל! מתי את/ה פנוי/ה? [כמו שבוע שעבר] [לעדכון]
- And one short group post for members who aren't registered: `סמנו זמינות לשבוע הבא 👇 [הצטרפות / עדכון]`.
- **Reminder:** members who didn't answer get one reminder after a configurable delay (default 14 h). "Didn't answer" means they didn't tap anything on the prompt. Note that carry-over still applies if they never answer.
- Private messages respect quiet hours (default 22:00–07:00): anything due then waits until quiet hours end.

### 5.5 Proposing a session

Organizers only, private chat, `/propose` or from the overview:

1. Pick a day (this week and next) → start time (granularity steps, inside opening hours) → duration (default from config, e.g. 60 min; organizer can change, e.g. 09:30–11:00) → optional location and notes (if enabled in config) → deadline (default: 2 h before start; if the session is sooner than that, the deadline is the start time) → `גם אני משתתף/ת` toggle (starts as `organizerCountsByDefault`). If on, the organizer is added to the in-list and counts toward the minimum.
2. **Preview:** the bot shows who matches before posting: `מתאימים: אלון, שירה. אולי: דנה. לפרסם? [פרסום] [עריכה] [ביטול]`
3. **Overlap warning:** if another open or set session in the group overlaps this time, the organizer sees `שים/י לב: יש כבר אימון ביום ה׳ 19:00` and can still post.
4. On **פרסום** the bot posts in the group (5.6).

### 5.6 Matching and the group post

- **Match** = the member's availability for that week fully covers [start, start + duration]. **Maybe** = partial overlap. Organizer is excluded.
- **Matches found:** one group post that tags the matches and lists the maybes without tagging:
  > 🎾 אימון חדש! יום ה׳ 13.11, 19:00–20:00
  > 📍 מגרש 3
  > @אלון @שירה — סימנתם שאתם פנויים. באים?
  > אולי פנויים: דנה
  > ✋ באים (0): —
  > [אני בא ✋] [לא הפעם]
- **Nobody matched:** the organizer gets a private message (`אף אחד לא סימן זמינות בשעה הזו.`). If `postWhenNoMatch` is on (default), the post still goes to the group without tags, so anyone whose plans changed can join.
- **Private messages to matches:** setting, off by default. When on, matched registered members also get the post with the same buttons privately.
- The group post **updates live**: the "באים" list and count change as people tap.

### 5.7 Booking

- **אני בא** → added to the in-list. **לא הפעם** → recorded as out (shown to the organizer, not in the group post). Tapping again toggles.
- **Undo before the session is set:** allowed, by tapping the other button.
- **Max reached** (if a max is set): the in-button shows `מלא` and further taps get a short popup `ה<noun> מלא`. No waitlist in v1.
- **Minimum reached** → the session is **set**. The bot posts (a reply to the original post) and tags everyone in:
  > האימון נקבע ✅ יום ה׳ 13.11, 19:00. באים: @אלון @שירה
  The organizer gets a private note too. More people can still tap in after it is set (until start, or until max).
- **After the session is set**, the in-button stays, but participants can't remove themselves through the bot. Dropping out is handled in a private chat between the participant and the organizer; the organizer can then remove the person in the bot (`/sessions` → the session → remove). If that drops the count below the minimum, the organizer is asked what to do (same options as the deadline below).
- **Deadline passes with the minimum not reached:** the organizer gets a private message: `לאימון ביום ה׳ 19:00 יש רק 1 מתוך 2. מה עושים? [לבטל] [להשאיר בכל זאת] [להאריך ב-שעה]`. Nothing is posted in the group until the organizer decides. "Keep anyway" marks it set.

### 5.8 Cancel and reschedule

- **Cancel** (organizer, `/sessions` → session → cancel): the original post is edited to show it's canceled, and a reply tags everyone who was in: `האימון ביום ה׳ 19:00 בוטל ❌`.
- **Reschedule** in v1 = cancel + new proposal.

### 5.9 Reminders and lists

- **Before the session:** registered members who are in get a private reminder X hours before (default 3 h): `תזכורת: אימון היום ב-19:00 📍 מגרש 3`.
- **/sessions:** upcoming sessions in this group (or all of my groups, in private), each with status (open / set / canceled) and who is in.
- **/overview** (if allowed): a private week grid with the number of free members per slot per day (`ה׳ ערב: 4`); tap a cell to see the names and a `[להציע אימון כאן]` button that starts 5.5 with that day and time filled in.

### 5.10 Settings

- `/settings` in the group (admins) opens a private menu with buttons, grouped as: wording, schedule (slots, opening hours, active days), sessions (min/max, duration, granularity, deadline, fields), people (organizers, overview visibility), notifications (weekly prompt, reminders, quiet hours, private messages, no-match post).
- Every change is validated (e.g. slot end after start, min ≤ max, times inside opening hours) and rejected with a clear Hebrew message if invalid.
- Changes apply to future prompts and proposals; sessions already posted keep their values.

### 5.11 Privacy and data

- **Public in the group:** session posts, who is in, tags of matches, the "maybe" names on a post.
- **Private:** each member's full availability (visible only to the member, and to organizers or all participants via `/overview` as configured), "out" answers (organizer only).
- **Stored:** Telegram user id, first/last name, username, per-group availability, bookings, group config. Nothing else (no phone numbers, no message content).
- **/forget:** deletes all of the member's data in all groups, after a confirm button.
- **Bot removed from a group:** the bot stops; that group's data is deleted 30 days later (re-adding it within 30 days restores everything).

### 5.12 Edge cases

- **Holidays:** no special handling.
- **Timezones:** each group has a timezone (default Asia/Jerusalem); all times are shown in it. Daylight-saving changes must not shift slots or sessions.
- **Bot down or restarted:** all state is stored; on restart, scheduled messages that were missed are sent if still relevant (a prompt or reminder whose moment passed less than a few hours ago), otherwise skipped. Session posts and buttons keep working.
- **Session in the past:** can't be proposed. Buttons on posts whose start time passed answer `ה<noun> כבר התחיל/ה`.
- **Member without a username:** tagged by name using a Telegram user mention link.
- **Organizer list member leaves the group:** removed from the organizer list.
- **Telegram limits:** the bot sends one post per event (tags inside it), not a message per person, to stay under Telegram's rate limits.

### 5.13 Abuse and limits

- **Allowlist (v1):** the bot only works in groups the operator approved (an operator-only command, outside group config). Other groups get a polite message and the bot leaves.
- Later: open to everyone with a max number of groups and basic rate limits.

## 6. Out of scope for v1

Not built now (some may never be):

- Payments, and attendance tracking (not planned at all for now).
- Waitlist, and a drop-out flow inside the bot.
- Several session types per group (the config is ready for it later).
- Several time options in one proposal.
- Repeating sessions (e.g. every Tuesday 19:00).
- Free-text or AI parsing (e.g. typing "מחר 19:00").
- Calendar sync, a web dashboard, other languages.
- More presets and the full setup wizard (v1 has one preset and a short `/setup`).
- Session history beyond the upcoming list.
- Holiday calendars.

## 7. Configuration reference

All settings are per group. "Later" means the field exists in the design but has no UI or effect in v1.

| Setting | Type | Default | Tennis preset | v1 |
|---|---|---|---|---|
| `timezone` | IANA tz | `Asia/Jerusalem` | same | ✅ (no UI) |
| `weekStartDay` | weekday | Sunday | same | ✅ (no UI) |
| `noun.singular` | text | `מפגש` | `אימון` | ✅ |
| `noun.plural` | text | `מפגשים` | `אימונים` | ✅ |
| `noun.gender` | `m` / `f` | `m` | `m` | ✅ |
| `activeDays` | weekdays | all | all | ✅ |
| `openingHours` | per weekday: start–end | 07:00–22:00 | Sun–Fri 07:00–22:00, Sat 07:00–20:00 | ✅ |
| `slots` | list of {name, start, end} | בוקר 07–12, צהריים 12–16, ערב 16–22 | same | ✅ |
| `exactHoursEnabled` | bool | on | on | ✅ |
| `timeGranularityMin` | 15 / 30 / 60 | 30 | 30 | ✅ |
| `defaultDurationMin` | minutes | 60 | 60 | ✅ |
| `minParticipants` | int ≥ 1 | 2 | 2 | ✅ |
| `maxParticipants` | int or none | none | none | ✅ |
| `organizerMode` | `everyone` / `list` | `everyone` | `everyone` | ✅ |
| `organizers` | list of members | — | — | ✅ |
| `organizerCountsByDefault` | bool | off | off | ✅ |
| `overviewVisibility` | `organizers` / `all` | `organizers` | `organizers` | ✅ |
| `sessionFields.location` | off / optional / required | optional | optional | ✅ |
| `sessionFields.notes` | off / optional | optional | optional | ✅ |
| `sessionFields.price` | off / optional / required | off | off | later |
| `defaultDeadlineHoursBefore` | hours | 2 | 2 | ✅ |
| `onMinNotReached` | `askOrganizer` / `autoCancel` / `keep` | `askOrganizer` | `askOrganizer` | ✅ (`askOrganizer` only) |
| `weeklyPrompt.enabled` | bool | on | on | ✅ |
| `weeklyPrompt.day` / `.time` | weekday / HH:MM | Saturday 20:00 | same | ✅ |
| `weeklyPrompt.cadence` | weekly / bi-weekly | weekly | weekly | later |
| `weeklyPrompt.reminderAfterHours` | hours or off | 14 | 14 | ✅ |
| `carryOverLastWeek` | bool | on | on | ✅ |
| `notify.tagInGroup` | bool | on | on | ✅ |
| `notify.privateToMatches` | bool | off | off | ✅ |
| `notify.postWhenNoMatch` | bool | on | on | ✅ |
| `reminder.hoursBefore` | hours or off | 3 | 3 | ✅ |
| `quietHours` | start–end or off | 22:00–07:00 | same | ✅ |
| `sessionTypes` | list | one type | one type | later |
| `messageTemplates` | custom texts | built-in | built-in | later |

## 8. Worked example: the tennis preset

"Sports training with a coach" preset, as a group of friends training with a coach would use it:

- Noun: אימון / אימונים, masculine → "האימון נקבע ✅".
- Slots: בוקר 07–12, צהריים 12–16, ערב 16–22. Club hours: Sun–Fri 07:00–22:00, Sat 07:00–20:00 (so ערב on Saturday is 16–20).
- Anyone can propose: the coach proposes training; a player can propose a game without the coach.
- Min 2 players, no max. Duration 60 min by default; the coach can offer 09:30–11:00.
- Weekly prompt Saturday 20:00, reminder Sunday 10:00 (14 h later). Pre-session reminder 3 h before.

A typical week:

1. Saturday 20:00: everyone gets "שבוע חדש מתחיל!". Alon taps `כמו שבוע שעבר`. Shira marks Thursday ערב and Friday 15:00–18:00. Dana doesn't answer; Sunday 10:00 she gets a reminder; she still doesn't answer, so last week's (Thursday 18:00–19:30) carries over.
2. Wednesday: the coach opens `/propose` → Thursday → 19:00 → 60 min → מגרש 3. Preview: matches Alon and Shira (free for all of 19:00–20:00), maybe Dana (free only until 19:30). The coach taps פרסום.
3. The group sees the post tagging the matches. Alon taps אני בא (1/2). Shira taps אני בא (2/2) → "האימון נקבע ✅ יום ה׳ 13.11, 19:00. באים: @אלון @שירה".
4. Thursday 16:00: Alon and Shira get the 3 h reminder.
5. If only Alon had tapped by the deadline (17:00), the coach would get "יש רק 1 מתוך 2. מה עושים?".
