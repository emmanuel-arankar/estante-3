## 2026-06-21 - [Hero Animation Jitter]
**Learning:** Using `Math.random()` directly inside a component's render loop for Framer Motion properties causes visual jitter and redundant CPU usage, as values are regenerated on every re-render. This is particularly noticeable when the parent component has high-frequency state updates (like a search input).
**Action:** Always memoize random property generation for background animations using `useMemo` and isolate high-frequency state (like input fields) into standalone child components to prevent expensive parent re-renders.
