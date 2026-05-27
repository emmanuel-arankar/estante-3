## 2026-05-27 - Memoization of Friends List Components
**Learning:** Components in `src/components/friends/DenormalizedFriendsList.tsx` (e.g., `FriendCard`, `MutualFriendsIndicator`, `FriendListItem`) were identified as performance bottlenecks because they lacked `React.memo` and `displayName`, causing O(N) re-renders during search and filter operations.
**Action:** Apply `React.memo` and `displayName` to these components and stabilize callbacks with `useCallback` to prevent unnecessary re-renders.
