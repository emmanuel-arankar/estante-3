## 2026-03-26 - [Chat List Optimization]
**Learning:** Found an $O(N \cdot G)$ grouping anti-pattern where messages were grouped by day using `.find()` on the groups array for every message. In long chats, this leads to unnecessary overhead. Since messages are chronologically sorted, a single-pass $O(N)$ approach comparing only with the last group is sufficient.
**Action:** Use single-pass grouping for sorted datasets.

## 2026-03-26 - [Advanced Stability Pattern for Chat]
**Learning:** In high-frequency components like Chat, callbacks often depend on the `messages` array, causing them to change on every new message and breaking `React.memo()` on child components. Using a `useRef` to track the latest `messages` inside a `useEffect` allows callbacks to remain referentially stable while still accessing the most recent data.
**Action:** Implement `messagesRef` pattern when passing callbacks to memoized list items.
