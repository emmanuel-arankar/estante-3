# Bolt's Journal - Critical Performance Learnings

## 2026-07-23 - Notification Memoization and Array Derivations
**Learning:** In React, transforming arrays inside hooks or render methods (such as `.flatMap()` or `.slice()`) creates new array references on every render. This invalidates reference checks and triggers cascade re-renders of child components in lists. Memoizing these derivations with `useMemo` preserves reference equality. Combining this with `React.memo` on list items like `NotificationItem` dramatically reduces rendering overhead.
**Action:** Always memoize array transformations inside custom hooks or render paths. Ensure all list elements are optimized with `React.memo` and have explicit `displayName` values for clear debugging.
