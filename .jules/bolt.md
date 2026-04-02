## 2026-04-02 - [Optimized Chat Component Rendering and Data Processing]
**Learning:** For chat lists with high-frequency updates, simple memoization isn't enough; referential stability of props is critical. Even with `React.memo`, closures in parent components (like `onDelete={() => deleteMessage(id)}`) trigger re-renders.
**Action:** Always refactor callback props to accept identifiers (e.g., `onDelete(id: string)`) and wrap them in `useCallback()` to maintain stable function references across parent renders.

## 2026-04-02 - [O(N) Grouping for Sorted Data]
**Learning:** When data is guaranteed to be sorted (like chat messages), grouping with `.find()` is an unnecessary O(N*G) overhead.
**Action:** Implement grouping logic with a single-pass O(N) approach by comparing items only with the tail of the groups array.
