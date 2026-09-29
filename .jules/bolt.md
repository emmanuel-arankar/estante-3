# Bolt's Performance Journal

## 2026-09-29 - Derived Data Reference Stability in Custom Hooks
**Learning:** Custom hooks that derive collections using methods like `.flatMap()` or `.filter()` without `useMemo` create new array instances on every single render. This breaks reference equality and invalidates downstream `useMemo` / `React.memo` optimizations in all consuming components.
**Action:** Always wrap collection transformations inside custom React hooks in `useMemo` dependent on the source query/state data to preserve reference stability across renders.
