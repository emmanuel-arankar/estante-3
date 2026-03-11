## 2025-05-14 - Chat Performance Optimizations

**Learning:** Large chat histories were suffering from O(N*G) complexity during message grouping (where G is the number of date groups) because `groups.find` was used in a loop. Also, high-frequency components like `ChatMessage` and `Avatar` were re-rendering unnecessarily due to unstable callback props and lack of memoization.

**Action:** Leverage the sorted nature of chat messages to implement O(N) grouping. Use `React.memo` on frequent components and ensure all callbacks passed to them are stabilized with `useCallback`, refactoring callback signatures to accept IDs/objects where necessary to maintain stability.
