## 2025-05-15 - Rendering Bottleneck in Animated Hero Component
**Learning:** Parent components holding frequently changing state (like a search input) cause all children to re-render. If children contain complex animations using `Math.random()` in the render loop, it causes visual jitter (\"jumping\" particles) and high CPU usage.
**Action:** Isolate high-frequency state into standalone components and stabilize random properties with `useMemo` in memoized sub-components.

## 2026-06-26 - Vitest Mock Hoisting with Top-Level Variables
**Learning:** When using `vi.mock` with a factory function that depends on external variables, Vitest will fail with a `ReferenceError` because `vi.mock` is hoisted to the top of the file, before the variables are initialized.
**Action:** Use `vi.hoisted` to define variables that need to be available inside a `vi.mock` factory.
