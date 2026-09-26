## 2026-09-26 - Memoize friend list items in DenormalizedFriendsList
**Learning:** In `DenormalizedFriendsList`, frequent user search typing updates parent state, re-rendering all `FriendCard` and `MutualFriendsIndicator` instances across lists.
**Action:** Wrap card and indicator sub-components in `React.memo` with explicit `displayName`s to prevent O(N) card re-renders during search typing.
