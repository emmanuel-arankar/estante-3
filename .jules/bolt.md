## 2026-10-15 - PrefetchLink Memoization in Dense List Views
**Learning:** `PrefetchLink` is heavily used across high-density list components like `DenormalizedFriendsList`, `ReviewCard`, `ReviewComments`, and `rich-text-editor` mention chips. Without `React.memo` and `useCallback` on `handleMouseEnter`, parent re-renders recreate handler functions and force re-renders for every link item in the list.
**Action:** When creating reusable UI link components or items used in lists, always wrap with `React.memo(React.forwardRef(...))` and memoize internal hover/focus handlers with `useCallback`.
