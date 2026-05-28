# Bolt's Journal - Critical Learnings

## 2025-05-15 - [Initial Bottleneck Identification]
**Learning:** Found that `DenormalizedFriendsList.tsx` and its sub-components (like `FriendCard`, `MutualFriendsIndicator`, and `SortDropdown`) lack memoization. This causes O(N) re-renders of the entire list whenever the search query or sort order changes, even if individual list items haven't changed.
**Action:** Implement `React.memo` and stabilize callbacks with `useCallback` to prevent redundant re-renders.
