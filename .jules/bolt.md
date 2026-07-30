# Bolt's Performance Journal

This journal documents critical performance learnings in this codebase.

## 2026-07-30 - [Hero Background Animation Performance]
**Learning:** Using `Math.random()` in React render paths for Framer Motion animation properties (like layout styles and animation durations) causes two major issues:
1. Severe visual jitter/jumping of elements because new random coordinates are generated on every render (e.g., when typing in a search input within the same component).
2. Heavy recalculations and style reflows on every keystroke, leading to high CPU/GPU usage.
To solve this, animation bubble parameters (positions, delays, durations) must be memoized using `useMemo` so they remain stable across re-renders.
**Action:** Use `useMemo` to generate a stable, deterministic set of animation properties for background elements, ensuring they are only computed once and don't re-evaluate unless critical dependencies change.
