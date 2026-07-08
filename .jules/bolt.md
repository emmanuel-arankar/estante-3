## 2026-07-08 - Stabilizing Hero Background Particles
**Learning:** High-frequency state updates in a parent component (like a search input) trigger full re-renders of heavy children. Using Math.random() in the render body causes visual jitter and redundant computations.
**Action:** Isolate animated backgrounds into memoized components and stabilize random properties with useMemo.
