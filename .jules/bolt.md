# Bolt's Journal - Critical Learnings Only

## 2026-08-07 - Memoization of Paginated Lists and Derived Array Hook States
**Learning:** Returning fresh array references (such as from `.flatMap` or `.slice`) inside custom hooks or lists breaks React memoization downstream. By memoizing the derived flat mapped array inside `useNotifications` and the slice in `NotificationDropdown`, alongside wrapping list items in `React.memo`, we can eliminate redundant component tree re-renders completely.
**Action:** Always wrap hook-derived collections and intermediate array transformations in `useMemo` before exposing them, and ensure individual list items are memoized using `React.memo` to preserve reference stability and render performance.
