# AGENTS.md

Static browser quiz. No build step, package manager, tests, lint, or formatter.

## Layout
- `index.html` — markup only; loads `style.css` and `boss.css`, then `questions.js`, `boss.js`, `script.js` at the end of `<body>`.
- `style.css` — quiz styles.
- `questions.js` — global `questions` array.
- `script.js` — quiz logic in an IIFE; consumes the global `questions`.
- `boss.css` / `boss.js` — solo boss challenge. `boss.js` exposes `window.BossChallenge.start({ onFinish })` and renders to `#bossCanvas`.

## Editing rules
- Keep HTML/CSS/JS separated; do not reintroduce inline `<style>` or `<script>`.
- Keep relative asset paths: the page must work both by double-clicking `index.html` (`file://`) and on GitHub Pages.
- Question shape: `{ question, answers: [4 strings], correct: <zero-based index> }`.
- `totalQuestions` is derived, but the solo result thresholds/messages in `showSoloResult()` are hardcoded for 6 questions. Update them (including `0 из 6`) whenever the question count changes.
- In solo, `showSoloResult()` launches the boss challenge when `score <= totalQuestions / 2` (currently 0–3 of 6). Higher scores show the normal result screen.
- Boss controls: `A`/`D` and `W`/`S` move; each Space key press fires one shot (key repeat is ignored). No mouse shooting.
- Boss damage flow: the shield absorbs 10 torpedo hits and must visibly break before the boss takes damage; torpedoes then deal only 3 damage each. Basic lasers never damage the boss.
- The phase-2 beam tracks the player with limited speed during its charge, then locks and fires.
- Duel scores are intentionally hidden during play; they appear only on the round summary and final screen.

## Verify
- No automated checks. Open `index.html` and manually play both modes: counters, solo result, duel round summary, and final score.
- Pushing to `main` auto-deploys `https://parazlor.github.io/quzzit/` via GitHub Pages (source: `main`, root). Allow 1–2 minutes after pushing.

## rules

- делать чистый код без мешанины HTML + CSS + JavaScript
- нужно чтобы index.html открывался в браузере
- никаких эмоджи