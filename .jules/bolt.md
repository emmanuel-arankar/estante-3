## 2026-05-15 - Stable Background Animations in Hero
**Learning:** Decorative background elements that use `Math.random()` for positioning or animation parameters within a component body will cause visual jitter and redundant O(N) recalculations whenever the component state (e.g., a search input) changes.
**Action:** Use `useMemo` with an empty dependency array to stabilize random parameters for decorative elements, ensuring they remain constant across re-renders while still providing variety on initial mount.
