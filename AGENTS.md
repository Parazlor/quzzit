# AGENTS.md

Static browser quiz. No build step, package manager, tests, lint, or formatter.

## Layout
- `index.html` — markup only; loads `style.css`, then `questions.js`, then `script.js` at the end of `<body>`.
- `style.css` — all styles.
- `questions.js` — global `questions` array.
- `script.js` — game logic in an IIFE; consumes the global `questions`.

## Editing rules
- Keep HTML/CSS/JS separated; do not reintroduce inline `<style>` or `<script>`.
- Keep relative asset paths: the page must work both by double-clicking `index.html` (`file://`) and on GitHub Pages.
- Question shape: `{ question, answers: [4 strings], correct: <zero-based index> }`.
- `totalQuestions` is derived, but the solo result thresholds/messages in `showSoloResult()` are hardcoded for 6 questions. Update them (including `0 из 6`) whenever the question count changes.
- Duel scores are intentionally hidden during play; they appear only on the round summary and final screen.

## Verify
- No automated checks. Open `index.html` and manually play both modes: counters, solo result, duel round summary, and final score.
- Pushing to `main` auto-deploys `https://parazlor.github.io/quzzit/` via GitHub Pages (source: `main`, root). Allow 1–2 minutes after pushing.

## rules

- делать чистый код без мешанины HTML + CSS + JavaScript
- нужно чтобы index.html открывался в браузере
- никаких эмоджи