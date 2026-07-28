# ⚡ Bolt's Performance Journal

## 2026-07-28 - [React Query Array Derivations & Memoization Ripple Effect]
**Learning:** Deriving lists or slices inline (e.g., `data?.flatMap(...)` or `array.slice(...)`) inside custom hooks or components breaks React's element memoization on polling queries because it generates brand new array references on every render.
**Action:** Always wrap array derivations (flatMap, filter, map, slice) inside `useMemo` when returning them from hooks or using them in component loops. Combine this with wrapping list-item components in `React.memo` with an explicit `displayName` to complete the performance optimization chain and completely eliminate redundant DOM updates.
