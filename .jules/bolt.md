## 2026-04-08 - [Optimized Chat Rendering and Grouping]

**Learning:** Chat components with high update frequency (e.g., real-time messages, audio progress) benefit significantly from `React.memo` and stabilized callbacks.

**Learning:** When `useCallback` depends on a frequently updating array (like `messages`), using a `useRef` to store the latest value and updating it in a `useEffect` allows the callback to remain referentially stable while still accessing the most recent data. This "Advanced Stability Pattern" prevents children (like `ChatBubble`) from re-rendering unnecessarily when the message list grows.

**Learning:** Message grouping can be optimized from $O(N \cdot G)$ to $O(N)$ by leveraging the chronological order of messages and only comparing the current message with the last group.

**Action:** Apply `React.memo` to list items and stabilize parent callbacks using refs to ensure effective memoization in high-frequency UI components next time.
