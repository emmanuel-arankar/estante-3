## 2026-06-16 - Hero Component Optimization
**Learning:** High-frequency state updates (like search input) in components with complex background animations cause both performance degradation and visual jitter if animation properties are randomized on each render.
**Action:** Isolate high-frequency state into child components and use `useMemo` to stabilize randomized animation properties.
