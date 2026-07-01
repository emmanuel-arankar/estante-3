## 2025-05-14 - Unstable random values in render loops
**Learning:** Using `Math.random()` inside a component's render loop for animation properties (like position or delay) causes visual jitter and redundant calculations whenever the component or its parent re-renders. This is particularly noticeable in components with high-frequency state updates, such as those containing search inputs.
**Action:** Stabilize random properties using `useMemo` with an empty dependency array, and extract frequently changing state into child components to prevent parent re-renders.
