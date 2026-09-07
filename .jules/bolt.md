## 2026-09-07 - Hook-Derived Collection Memoization
**Learning:** Returning unmemoized arrays (such as `.flatMap()` or `.filter()` results) from custom hooks causes new array references on every component render or polling tick. This breaks shallow equality checks in subscriber components that depend on `useMemo` or `React.memo`.
**Action:** Always wrap collection derivations inside custom hooks in `useMemo` dependent on source query data to preserve reference identity across re-renders and polling intervals.
