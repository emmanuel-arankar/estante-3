## 2025-05-15 - Rendering Bottleneck in Animated Hero Component
**Learning:** Parent components holding frequently changing state (like a search input) cause all children to re-render. If children contain complex animations using `Math.random()` in the render loop, it causes visual jitter ("jumping" particles) and high CPU usage.
**Action:** Isolate high-frequency state into standalone components and stabilize random properties with `useMemo` in memoized sub-components.
