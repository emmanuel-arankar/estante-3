# Bolt's Performance Journal

## 2026-08-17 - Reference Stability for Hook-Derived Array Collections
**Learning:** Returning newly constructed arrays from custom hooks (e.g., `flatMap` on paged query data in `useNotifications`) creates a new array reference on every render or polling tick. This breaks `React.memo` downstream in list items and dropdown components.
**Action:** Always wrap hook-derived collections and array slicing operations in `useMemo` with explicit dependencies to preserve reference stability across re-renders.
