## 2026-06-04 - [Stabilizing Randomness in Render]
**Learning:** Using Math.random() directly in the render loop for component properties (especially for Framer Motion animations) causes visual jitter and redundant processing as values regenerate on every re-render.
**Action:** Always wrap random value generation in useMemo when they are intended to stay constant for the lifetime of the component.

## 2026-06-04 - [State Isolation for Inputs]
**Learning:** Inputs in complex components cause the entire tree to re-render on every keystroke if state is kept in the parent.
**Action:** Extract search bars and other high-frequency inputs into standalone components to isolate re-renders and preserve the stability of heavy background elements or animations.
