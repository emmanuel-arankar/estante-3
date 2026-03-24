## 2026-03-24 - [Optimizing Chat List Rendering]
**Learning:** In high-frequency components like chat bubbles, `React.memo` is only effective if combined with `useCallback` for all event handlers and stable prop signatures (e.g., passing IDs instead of closures). Additionally, message grouping logic should use a single-pass O(N) algorithm instead of O(N*G) by leveraging the pre-sorted order of messages.
**Action:** Always wrap chat event handlers in `useCallback`, refactor child props to accept identifiers, and use a single-pass grouping algorithm for sorted datasets.
