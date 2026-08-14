# Bolt's Journal - Critical Learnings

## 2026-08-14 - [Deterministic Animation Coordinates & Transition parameters with useMemo]
**Learning:** Using `Math.random()` in render paths for animations (such as background particles or bubble animations) causes severe visual jitter because elements teleport to new positions on every component re-render (e.g., when a user types in a text input field). It also ruins Server-Side Rendering (SSR) hydration compatibility, causing mismatch exceptions between server-rendered and client-rendered HTML values.
**Action:** Always wrap coordinate and animation configuration generation in `useMemo` using deterministic, index-based or seed-based mathematical formulas instead of `Math.random()`. This ensures absolute visual and coordinate stability, prevents recreation of animation cycles during parent state updates, and guarantees perfect SSR hydration compatibility.
