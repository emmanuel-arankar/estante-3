# Bolt's Performance Journal

## 2026-08-25 - Array Derivations from Custom Hooks Break Downstream Memoization
**Learning:** Custom hooks returning newly constructed array or object references (such as `.flatMap()` or `.filter()` results) cause downstream components and memoized hooks/selectors using reference equality checks to invalidate on every render cycle (e.g., during 30s background polling updates for `unreadCount`).
**Action:** Always wrap hook-derived collections and transformations in `useMemo` with appropriate query data dependencies before returning them from custom React hooks.
