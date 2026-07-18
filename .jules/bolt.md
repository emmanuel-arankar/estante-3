# Bolt's Performance Journal

## 2026-07-18 - Notification Rerenders & Unstable Array References
**Learning:** Polling or other updates in parent components like layouts/headers cause downstream list components like NotificationDropdown to re-render. If list items are not memoized and array slices are done in-render, all items re-render redundantly.
**Action:** Wrap individual items in React.memo with clear displayNames, memoize flatMap/derived arrays in the hooks with useMemo, and memoize in-render array transformations like .slice() in parent components to maintain stable references.
