## 2024-04-24 - Avoid Lockfile Pollution in Workspace Environments
**Learning:** Running `npm install` in certain workspace environments or with different npm versions can trigger massive, unrelated changes to `package-lock.json` (e.g., removing `peer: true` entries). This pollutes PRs and can break dependency resolution.
**Action:** Always verify `package-lock.json` after running environment setup commands. If unintentional changes are detected, restore the lockfile before submitting to keep the patch focused on the actual task.

## 2024-04-24 - O(N) Re-render Bottleneck in Friends List
**Learning:** The `DenormalizedFriendsList` suffered from O(N) re-renders during search input. Even with a 500ms debounce on the search term, the parent component re-renders on every keystroke to update the `searchQuery` state, causing every item in the friends/requests list to re-render.
**Action:** Apply `React.memo()` to list items and internal indicators (like `MutualFriendsIndicator`). Since `useDenormalizedFriends` action handlers are stable `mutateAsync` functions, memoization effectively skips re-renders for all list items until the debounced search results actually update the data.
