## 2026-04-18 - Optimized Message Grouping
**Learning:** In chat applications with large message histories, using `array.find()` to group messages by date results in O(N*G) complexity, which becomes a bottleneck.
**Action:** Use a single-pass O(N) grouping algorithm by leveraging the fact that messages are already chronologically sorted and comparing each message only to the tail of the groups array.

## 2026-04-18 - Component Stability and Memoization
**Learning:** Memoization with `React.memo` is only effective if callback props are referentially stable. Anonymous functions in JSX props (e.g., `onPlayNext={() => handlePlayNext(id)}`) break memoization.
**Action:** Refactor callback props to accept identifiers or the full object, and use `useCallback` in the parent. For callbacks that depend on frequently updating data (like `messages`), use a `useRef` to maintain the latest value without changing the callback's identity.
