# Bolt's Performance Journal

## 2026-09-08 - Profile Component Memoization
**Learning:** Profile-related modal and indicator sub-components (`PhotoViewer`, `ProfilePhotoMenu`, `MutualFriendsIndicator`) in `Profile.tsx` were unmemoized and re-rendered on every parent state change (such as tab switches, route changes, or friendship status updates).
**Action:** Wrap sub-components in `React.memo` with explicit `displayName`s and JSDoc documentation to prevent unnecessary VDOM diffing during state changes in profile pages.
