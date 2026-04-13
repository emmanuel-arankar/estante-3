## 2026-04-13 - [Chat Performance Optimization]
**Learning:** In the chat component, every keystroke in the input was causing a full re-render of the message list because handlers were redefined on every render and `ChatBubble` was not memoized. Additionally, message grouping was using an O(N^2) algorithm with `.find()` on a chronologically sorted array.
**Action:** Wrapped chat components in `React.memo()`, stabilized callback props with `useCallback`, and refactored message grouping to a single-pass O(N) algorithm by comparing items with the tail of the groups array.
