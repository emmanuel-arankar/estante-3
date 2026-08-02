# Bolt's Journal - Critical Learnings

## 2026-08-02 - Hook-derived Array References Break Downstream Memoization
**Learning:** Returning newly constructed arrays or object references (like `.flatMap()` or `.filter()`) from custom React hooks on every render bypasses dependency checks for downstream `useMemo` or `React.memo` components. In this codebase, the `useNotifications` hook generated a fresh `notifications` array on each render, which caused cascading re-renders in the notification dropdown and main page during polling or parent component state updates.
**Action:** Always wrap derived collections (arrays, objects) computed from query pages/data in a custom hook inside `useMemo`, referencing the query's data as a dependency, to keep array references stable across renders.
