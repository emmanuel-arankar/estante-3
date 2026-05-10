# Bolt's Journal - Critical Performance Learnings

## 2025-05-14 - [Hero component re-renders]
**Learning:** The `Hero` component in `src/components/home/Hero.tsx` originally recalculated `Math.random()` values for background animations on every keystroke in the search input due to state-triggered re-renders. This caused visual layout shifts and redundant processing.
**Action:** Use `useMemo` to stabilize the random values for background elements to ensure they persist across re-renders.
