## 2024-05-15 - Prevented massive package-lock.json regression
**Learning:** Running `npm install` in some environments can cause massive, unrelated changes to `package-lock.json` (e.g., removing `"peer": true` fields), which clutters PRs and risks dependency issues.
**Action:** Always verify `package-lock.json` after running `npm install`. If unrelated changes are detected, revert them immediately using `git checkout package-lock.json` before submitting.

## 2024-05-15 - Memoization for O(N) list re-renders
**Learning:** In list components with a search bar (like `DenormalizedFriendsList.tsx`), parent state updates on every keystroke cause all child items to re-render, even if the list content hasn't changed yet (due to debouncing).
**Action:** Wrap list item components and their internal sub-components (like indicators) in `React.memo()` and assign `displayName` to maintain O(1) re-renders for stable items during high-frequency parent updates.
