# Groot UI audit findings

Branch: `improve/groot-ux-full`  
Rules: userinterface-wiki + make-interfaces-feel-better  
Status: **P0 implemented**

## Backlog summary

| Priority | Count | Status |
|----------|-------|--------|
| P0 | 14 | fixed |
| P1 | 6 | open |
| P2 | 4 | open |

---

## Zone A — Layout, chat input, recent, TOC

| Before | After | File | Rule | Severity |
|--------|-------|------|------|----------|
| `AnimatePresence` without `initial={false}` on side drawer | `initial={false}` | `layout/root.tsx:129` | `exit-requires-wrapper` | HIGH |
| `AnimatePresence` without `initial={false}` on composer | `initial={false}` | `chat-input/input.tsx:132` | `exit-requires-wrapper` | HIGH |
| Greeting `duration: 0.8` | `0.26` + `initial={false}` | `chat-input/input.tsx:311-318` | `timing-under-300ms` | CRITICAL |
| Send/stop icon swap no explicit duration | `duration: 0.15` | `chat-input/chat-actions.tsx:164-183` | `mode-wait-doubles-duration` | MEDIUM |
| `transition-all` on sidebar width | `transition-[width,box-shadow]` | `layout/side-bar.tsx:84` | `none-high-frequency` | MEDIUM |
| `transition-all` on recent cards | explicit props + `active:scale-[0.96]` | `recent-threads.tsx:37` | `physics-active-state` | HIGH |
| `transition-all` on TOC dots | `transition-[width,background-color]` | `table-of-messages.tsx:40` | `none-high-frequency` | MEDIUM |
| TOC popover `AnimatePresence` default initial | `initial={false}` | `table-of-messages.tsx:57` | `exit-requires-wrapper` | HIGH |

---

## Zone B — Thread stack

| Before | After | File | Rule | Severity |
|--------|-------|------|------|----------|
| Step connector `duration: 0.5` | `0.26` | `thread/step-renderer.tsx:177` | `timing-under-300ms` | CRITICAL |
| Activity card `active:scale-[0.98]` | `0.96` | `thread/components/agent-activity-card.tsx:159` | `physics-active-state` | MEDIUM |
| Tool buttons already `0.96` | unchanged | `tool-call.tsx`, `message-actions.tsx` | — | OK |

---

## Zone C — @repo/ui primitives

| Before | After | File | Rule | Severity |
|--------|-------|------|------|----------|
| Button no press scale | `active:scale-[0.96]` + explicit transitions | `ui/button.tsx:9` | `physics-active-state` | HIGH |
| Accordion `transition-all` | `transition-[color,transform]` | `ui/accordion.tsx:30` | `none-high-frequency` | MEDIUM |
| Tabs `transition-all` | `transition-[color,border-color]` | `ui/tabs.tsx:32` | `none-high-frequency` | MEDIUM |
| Toast `transition-all` | `transition-[transform,opacity]` | `ui/toast.tsx:27` | `none-high-frequency` | MEDIUM |
| OTP `transition-all` | explicit + `tabular-nums` | `ui/input-otp.tsx:44` | `type-tabular-nums-for-data` | MEDIUM |
| Dialog `AnimatePresence` | `initial={false}` | `ui/dialog.tsx:11` | `exit-requires-wrapper` | HIGH |

---

## Zone D — apps/web routes + globals

| Before | After | File | Rule | Severity |
|--------|-------|------|------|----------|
| `ui-enter` animation 800ms | 280ms via `--motion-duration-enter` | `globals.css:46-49` | `timing-under-300ms` | CRITICAL |
| No reduced-motion guard on enter | `@media (prefers-reduced-motion)` | `globals.css` | `morphing-reduced-motion` | HIGH |
| Headings lack `text-wrap: balance` | `h1–h4 { text-wrap: balance }` | `globals.css` | `type-text-wrap-balance-headings` | MEDIUM |
| Body lacks pretty wrap | `body { text-wrap: pretty }` | `globals.css` | `type-text-wrap-pretty` | LOW |
| `antialiased` on body | unchanged (OK) | `routes/__root.tsx:40` | `type-antialiased-on-retina` | OK |

---

## Consolidated P0 / P1 / P2

### P0 (fixed)

All items in tables above marked fixed in this branch.

### P1 (should fix)

| Before | After | File | Rule | Status |
|--------|-------|------|------|--------|
| Icon toggles use scale 0.8 not 0.25→1 pattern | Cross-fade blur pattern per skill | `chat-actions.tsx` | `morphing-*` | open |
| `motion-skeleton` duration 2s | Shorten or gate reduced-motion | `motion-skeleton.tsx:12` | `timing-under-300ms` | open |
| Collapsed sidebar icon buttons may be &lt;40px hit | Pseudo-element hit expansion | `side-bar.tsx` | `ux-fitts-hit-area` | open |
| Image attachments lack rgba outline | `outline` 1px black/white 10% | imagine/gallery components | `visual-*` | open |
| Token duplication `globals.css` vs `ui/styles.css` | Consolidate or document single source | both CSS files | maintainability | open |
| `components.json` stale paths | Align with `apps/web/src/styles` | `apps/web/components.json` | — | open |

### P2 (nice to have)

| Before | After | File | Rule | Status |
|--------|-------|------|------|--------|
| Stagger `--delay: 100ms` on animate-enter | Reduce to 50ms per item | `globals.css` | `physics-no-excessive-stagger` | open |
| Layered button shadows (6-layer anatomy) | Optional on primary CTA | `ui/button.tsx` | `visual-button-shadow-anatomy` | open |
| Prefetch on thread list hover | Trajectory prefetch | `side-bar.tsx` | `prefetch-*` | open |
| Sound feedback | N/A (not in product) | — | `a11y-*` | waived |
