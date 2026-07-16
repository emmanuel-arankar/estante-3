# Bolt's Journal - Performance Learnings

## 2026-07-16 - Stable Randomness and State Isolation in Hero Component

**Learning:** Using `Math.random()` directly in the render path of an animated component leads to visual jitter whenever the component re-renders. When this component is a parent to a high-frequency state update (like a search input), the entire UI feels unstable.

**Action:**
1. Isolate high-frequency state (inputs) into leaf components or dedicated sibling components.
2. Use `useMemo` with an empty dependency array to generate "stable" random values for animations that should persist across re-renders.
3. Memoize heavy decorative components (like backgrounds with many SVGs/motion nodes) using `React.memo`.
