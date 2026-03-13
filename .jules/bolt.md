## 2026-03-13 - [Chat Message Grouping Complexity]
**Learning:** Chat messages grouped by date using `array.find()` results in O(N*G) complexity. Since messages are already sorted by `createdAt` in this architecture, a single-pass O(N) comparison with the tail of the groups array is significantly more efficient.
**Action:** Implement grouping logic with a single-pass O(N) approach for sorted datasets.

## 2026-03-13 - [Stability Pattern for High-Frequency Components]
**Learning:** Wrapping components in `React.memo()` is only effective if props are referentially stable. In this codebase, passing inline arrow functions to `ChatBubble` was causing $N$ re-renders on every parent update.
**Action:** Refactor callback props to accept identifiers and use stable `useCallback` handlers with `useRef` to maintain stability even when data arrays change.
