# Bolt's Journal - Performance Learnings

## 2026-08-04 - [Memoizing derived arrays from custom hooks]
**Learning:** Returning newly constructed arrays or objects (such as `flatMap` or `filter` results) from custom React hooks on every render breaks downstream memoization. Even if the underlying data has not changed, the reference of the array changes, forcing dependent components and useMemo hooks to re-evaluate and re-render.
**Action:** Always wrap hook-derived collections and array derivations in `useMemo` within the hook to preserve reference stability and keep downstream `React.memo` structures effective.
