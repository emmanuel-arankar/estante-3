## 2025-06-11 - [Stabilized Hero Animations]
**Learning:** Using `Math.random()` directly in the render loop for component properties (especially for Framer Motion animations) causes visual jitter and redundant processing as values regenerate on every re-render. This is particularly noticeable in components with frequent state changes, like a search bar.
**Action:** Always memoize random visual properties using `useMemo` when they should remain static for the lifetime of the component or across standard re-renders.
