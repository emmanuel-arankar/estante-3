## 2026-06-01 - [Memoization of list components]
**Learning:** In the `DenormalizedFriendsList` component, typing in the search bar was triggering a full re-render of all friend cards and request cards because the parent state changed. Even if sub-components like `FriendCard` were relatively light, O(N) re-renders on every keystroke added noticeable lag and visual jitter.
**Action:** Use `React.memo` for list items and `useCallback` for all event handlers (remove, accept, reject, cancel, sort) passed to them. Explicitly import and use types like `SortOption` and `SortDirection` for callback parameters to maintain strict TypeScript compliance.

## 2026-06-01 - [Vite dev artifacts]
**Learning:** Running `npm run dev` with `vite-plugin-pwa` generates artifacts in `dev-dist/` and may modify `package-lock.json` if dependencies are missing.
**Action:** Always clean up `dev-dist/` and restore `package-lock.json` before submission to avoid committing build artifacts or unrelated metadata changes.
