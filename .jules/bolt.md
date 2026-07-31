## 2026-07-31 - Stabilizing Hero Background Animations
**Learning:** Using `Math.random()` inside render paths for styling or transition properties triggers recalculations, visual jitter (bubbles jumping positions), and reflow overhead whenever the component re-renders (such as during user input keystrokes in a search bar).
**Action:** Always memoize any dynamic/random rendering parameters using `useMemo` so they remain stable across re-renders unless their dependencies change.
