## 2026-04-30 - Stabilization of Background Animations

**Learning:** Component-level state changes (like search input typing) trigger full re-renders of the component tree. If decorative elements (like background dots) use `Math.random()` directly in the render loop or as inline styles without memoization, they will jump to new positions on every keystroke, causing visual jitter and redundant O(N) style calculations.

**Action:** Always use `useMemo` to stabilize decorative or animation parameters that should remain constant across re-renders triggered by unrelated state changes.
