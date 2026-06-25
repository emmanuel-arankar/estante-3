
## 2026-06-25 - [Hero Component Optimization]
**Learning:** Isolating high-frequency state updates (like search input) into sub-components prevents expensive parent re-renders, especially when parents contain many animated nodes or heavy computations like the Hero background. Using Math.random() directly in the render loop for animation properties causes visual jitter as values regenerate on every re-render.
**Action:** Extract search bars and other frequent inputs into standalone components. Use useMemo to stabilize random properties used in animations to ensure visual consistency and prevent redundant processing.
