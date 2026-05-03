## 2026-05-03 - Stabilizing Non-Deterministic Background Animations
**Learning:** Using `Math.random()` directly in the render loop for component styles (like background positions or animation timings) causes visual "jumps" and layout shifts on every state update, even if the state change is unrelated to the animations.
**Action:** Always wrap non-deterministic configuration values in `useMemo` with an empty dependency array to ensure referential stability and prevent visual jitter during re-renders.
