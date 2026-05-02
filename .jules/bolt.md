## 2026-05-02 - Stabilized Hero background animation parameters
**Learning:** The `Hero` component originally recalculated `Math.random()` values for background animations on every keystroke in the search input due to state-triggered re-renders. This caused visual layout shifts and redundant O(N) processing.
**Action:** Use `useMemo` with an empty dependency array to stabilize random parameters for decorative background elements, ensuring they only calculate once on mount.
