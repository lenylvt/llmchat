# Groot UI motion and polish patterns

## AnimatePresence defaults

Use `initial={false}` when the child is visible on first paint (shell drawers, composer chrome, TOC popover). Keeps `mode="wait"` swaps from animating on mount.

## Motion duration budget

User-initiated transitions stay under 300ms. Prefer CSS variables in `apps/web/src/styles/globals.css`:

- `--motion-duration-fast` (150ms)
- `--motion-duration-normal` (220ms)
- `--motion-duration-enter` (280ms)

## Press feedback

Interactive controls use `active:scale-[0.96]` with `motion-reduce:active:scale-100`. Applied on `@repo/ui` `Button` and thread tool surfaces.

## Transitions

Avoid `transition-all`. List explicit properties (`color`, `transform`, `width`, `box-shadow`).

## Typography

- `text-wrap: balance` on headings (`globals.css` base layer)
- `text-wrap: pretty` on body
- `tabular-nums` on OTP and numeric badges
