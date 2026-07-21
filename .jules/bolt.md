## 2026-07-20 - [Memoizing Paginated Array Derivations]
**Learning:** Wrapping `.flatMap()` or similar mapping functions over paginated Query data (like TanStack Query `useInfiniteQuery`) inside a custom React hook without memoization breaks referential equality on every single component render. Even if the query data remains identical, a new array reference is returned, prompting child list components (like list items or dropdowns) to perform expensive re-render cycles.
**Action:** Always wrap array mapping/transformations derived from TanStack query data inside `useMemo` with the raw query data (e.g. `query.data`) as a dependency.

## 2026-07-21 - [Array Slicing in JSX Maps and Memoized List Items]
**Learning:** Performing list transformations like `.slice()` or `.filter()` directly in the JSX render body or mapping loops creates a new array reference on every single component render. This defeats the purpose of wrapping child items in `React.memo`, as the mapped children still re-evaluate because their container maps over a fresh array reference.
**Action:** Always memoize intermediate list derivations (like `.slice()`) in the parent component with `useMemo` before mapping them, and ensure all list items are wrapped in `React.memo` for maximum performance synergy.
