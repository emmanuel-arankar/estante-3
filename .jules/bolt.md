## 2026-09-09 - Memoize Derived Collections in Custom Hooks
**Learning:** Returning unmemoized `flatMap` or `filter` results from custom hooks creates new array references on every component render, invalidating downstream `useMemo` calculations and `React.memo` checks in consuming UI components.
**Action:** Always wrap collection derivations like `.flatMap()` or `.filter()` inside custom hooks in `useMemo`, referencing query data pages or source collections as dependencies.
