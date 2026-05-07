# Bolt's Performance Journal ⚡

## 2025-05-15 - [Stabilizing Hero Background Animations]
**Learning:** The `Hero` component was recalculating `Math.random()` values for background animations on every keystroke in the search input. This caused visual layout shifts (dots jumping) and redundant $O(N)$ processing during high-frequency state updates.
**Action:** Use `useMemo` to stabilize non-deterministic UI parameters that don't depend on component state.
