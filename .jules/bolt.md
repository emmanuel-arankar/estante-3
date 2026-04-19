## 2025-05-14 - [Optimized Chat rendering and message grouping]
**Learning:** For chronologically sorted datasets like chat messages, grouping by date can be optimized from O(N*G) to O(N) by only comparing each item with the last group. Additionally, stabilizing callback props with `useCallback` and `useRef` is crucial for `React.memo` to be effective in long lists.
**Action:** Always prefer single-pass grouping for sorted data. Use the "Advanced Stability Pattern" (useRef + useCallback) for event handlers that depend on frequently changing state but are passed to memoized children.
