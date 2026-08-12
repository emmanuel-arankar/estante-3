# Bolt's Journal - Critical Performance Learnings

## 2026-08-12 - Deterministic Animations in SSR Contexts
**Learning:** Using `Math.random()` inside render paths or `useMemo` for background animations causes severe visual jitter on every re-render (e.g. typing in inputs). Furthermore, in SSR environments, `Math.random()` creates HTML markup on the server that differs from the client-side hydration, leading to hydration mismatches and UI resets.
**Action:** Memoize animation variables using `useMemo` with deterministic, index-based modulo formulas (e.g., `(index * multiplier + offset) % 100`) to guarantee stability, perfect SSR compatibility, and zero-jitter rendering.
