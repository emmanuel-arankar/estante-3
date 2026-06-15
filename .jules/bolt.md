## 2026-06-15 - Hero Component Optimization
**Learning:** Found that using `Math.random()` directly in the render loop for component properties (especially for Framer Motion animations) causes visual jitter and redundant processing as values regenerate on every re-render. Additionally, high-frequency state updates like search inputs should be isolated to prevent expensive parent re-renders.
**Action:** Extract search state into standalone components and memoize random/static animation properties to ensure stability and performance.
