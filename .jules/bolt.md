# Bolt's Journal - Critical Learnings

## 2026-10-07 - React Query Hook Return Memoization
**Learning:** Returning unmemoized objects or functions from custom React hooks that consume React Query (`useQuery`, `useInfiniteQuery`, `useMutation`) invalidates downstream component memoization on every render pass. Depending directly on React Query wrapper objects in `useCallback` dependency arrays causes callbacks to re-evaluate on every render because React Query produces new wrapper object references each pass. Extracting stable method references (such as `friendsQuery.refetch`) into local variables allows `useCallback` and `useMemo` to maintain stable reference equality across re-renders.
**Action:** Always extract stable method references from query/mutation objects before passing them as dependencies to `useCallback`, and wrap hook return objects in `useMemo`.
