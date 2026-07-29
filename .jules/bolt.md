## 2026-07-29 - [Stable Animation Generation in React Render Paths]
**Learning:** Generating coordinates, animation durations, or delays using `Math.random()` directly inside React component render paths leads to visual jitter and unexpected layout/animation resets on interactive state changes (like typing in text inputs that trigger parent re-renders). It also violates hydration consistency.
**Action:** Always memoize random coordinates and animation parameters using `useMemo` with appropriate dependencies to keep the values stable across renders while maintaining interactivity.
