## 2026-07-12 - Memoization in Friends List
**Learning:** Found that key list item components in `DenormalizedFriendsList.tsx` (FriendCard, RequestCard, etc.) were missing memoization, causing full list re-renders on every keystroke in the search bar. This is a common bottleneck in this codebase where large denormalized lists are rendered.
**Action:** Applied `React.memo` and `displayName` to all list item and indicator components in the friends module to stabilize rendering during search and filter operations.
