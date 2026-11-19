# Changelog

What changed in each release, newest first. Dates are UTC.

Updating a plugin always asks you to restart DSH before conversations that were
already open pick up the new code — so it is worth knowing what a release
changes before deciding when to restart. That is what this file is for.

## 0.2.5 — 2026-11-19

- The plugin UI, README, plugin page and the diagram now ship in all eight
  languages DSH offers: English, 简体中文, 日本語, Español, Français, Deutsch,
  Русский, Português. The interface language follows
  **Settings → General → Language** instead of picking between Chinese and
  English only.
- Each README is its own file with a language bar at the top, so a link opens
  that language directly.
- Fix three ways a message could get stuck with no answer:
  - a second message sent while the first one was still being judged (0.7 s)
    could be judged twice and move the level of a turn already running;
  - a message arriving during the three seconds the task card is written could
    slip in and then collide with the message waiting behind it;
  - the end of a subagent run could clear the state of other, still-open
    conversations and lock them shut.
- Browser side: recover when the local companion service moves to another port,
  time out requests instead of hanging forever, and show `—` instead of
  "working, 0 runs" when the service is not reachable.
- Drop the dead "state" row from the plugin page.

## 0.2.4 — 2026-11-19

- Fix: stopping a turn in the middle of an answer no longer swallows the next
  message. The host does not announce a turn that was stopped, so the plugin
  could believe a turn was still running and hold every later message forever.

## 0.2.3 — 2026-11-19

- Pin the README screenshots to the released version instead of `@latest`.
  jsDelivr caches `@latest` for a week, so a refreshed screenshot could keep
  showing the old bytes.

## 0.2.2 — 2026-11-19

- Add the GitHub repository, issues and homepage links to `package.json`.
- Refresh the plugin page and menu screenshots.

## 0.2.1 — 2026-11-19

- Serve the README screenshots from jsDelivr with absolute URLs, so they render
  on the npm page too.

## 0.2.0 — 2026-11-19

The paid version: judging costs one small model call per message and about
0.7 s of waiting.

- Replace the keyword rules with a DeepSeek judge call: one word out of
  `off` / `low` / `high` / `max`, using your message plus a task card of at most
  120 characters that the plugin keeps up to date in the background.
- The switch belongs to a conversation, not to the plugin: turning it off stops
  judging in that conversation only, and picking any effort by hand turns it off
  there as well.
- A message sent while a turn is running waits for that turn to finish, then
  gets its own judgement and is delivered as a new turn.
- If judging fails three times in a row, the plugin pauses in that conversation
  and shows a bar above the input box with the reason; one click turns it back
  on. A failure caused by a reloaded host (`inactive context`) is not counted.
- New settings: `judgeModel`, `timeoutMs`, `cardInputChars`, `cardMaxChars`.
- Drop `rules.js` and its accuracy benchmark.

## 0.1.2 — 2026-11-17

The last rules-based release. It picked a level from keywords in the message
plus the previous turn's step count, and never called a model.

## 0.1.1, 0.1.0 — 2026-11-17

First releases: the switch in the model menu, the running totals in the menu row
and on the plugin page, and the loopback service that counts them.
