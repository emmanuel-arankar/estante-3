## 2024-03-21 - [Efficient Grouping & Memoization]
**Learning:** O(N^2) grouping logic in chat applications can become a major bottleneck as message lists grow. Switching to a single-pass O(N) approach is a simple but effective win. Additionally, high-frequency parent state changes (like typing indicators) can cause expensive re-renders across the entire message list if components aren't properly memoized.

**Action:** Always prefer single-pass O(N) grouping for sorted datasets. Use `React.memo()` and `useCallback` to stabilize component hierarchies and prevent unnecessary re-renders in chat/feed UIs.
