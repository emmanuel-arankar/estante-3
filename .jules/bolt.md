# Bolt's Journal - Critical Learnings

## 2026-08-08 - Stable Hook Return References and React.memo
**Learning:** In React applications, wrapping child list components like `NotificationItem` in `React.memo` is only half the battle. If a custom hook like `useNotifications` returns a newly-constructed array (such as the result of a `flatMap` or `slice` operation) on every render, the reference changes. This breaks downstream memoization, causing children to re-render even if the underlying data has not changed.
**Action:** Always wrap hook-derived collections and intermediate array modifications (like `slice` or `filter`) in `useMemo` to preserve reference stability across renders, enabling `React.memo` on list item components to work at maximum efficiency.
