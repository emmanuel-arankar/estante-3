## 2026-07-26 - [Notification Optimization with useMemo and React.memo]
**Learning:** Derived array mappings in custom React hooks (e.g., flatMapping paginated pages in `useInfiniteQuery`) generate a new array reference on every single component render, causing downstream consumers and items to redundanty re-render even if data has not changed.
**Action:** Wrap any derived data calculations (such as `.flatMap()` or `.slice()`) in `useMemo` with minimal, specific dependency arrays to ensure stable array references, and combine with `React.memo` on list items for optimal performance.
