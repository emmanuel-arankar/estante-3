## 2025-05-15 - [O(N*G) to O(N) Message Grouping]
**Learning:** Found an $O(N \times G)$ bottleneck in `src/pages/Chat.tsx` where `.find()` was used inside a loop to group messages by date. Since messages are chronologically sorted, this can be optimized to $O(N)$ by only comparing with the tail of the groups array.
**Action:** Use single-pass comparison with the last element of the groups array for sorted datasets to avoid redundant searches.

## 2025-05-15 - [Component Stability with memo and useCallback]
**Learning:** High-frequency components like `ChatBubble` and `AudioPlayer` benefit significantly from `React.memo()`, but only if all props are referentially stable. Inline arrow functions in the parent component (`Chat.tsx`) were triggering unnecessary re-renders.
**Action:** Always wrap event handlers in `useCallback` when passed to memoized child components, and use `useRef` for frequently changing state (like `messages`) to keep handlers stable.
