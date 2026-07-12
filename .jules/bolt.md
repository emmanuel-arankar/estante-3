## 2026-07-12 - Memoization in Friends List
**Learning:** Found that key list item components in `DenormalizedFriendsList.tsx` (FriendCard, RequestCard, etc.) were missing memoization, causing full list re-renders on every keystroke in the search bar. This is a common bottleneck in this codebase where large denormalized lists are rendered.
**Action:** Applied `React.memo` and `displayName` to all list item and indicator components in the friends module to stabilize rendering during search and filter operations.

## 2026-07-12 - CI Environment & Firebase Initialization
**Learning:** Firebase Admin initialization with `initializeApp()` (without arguments) can fail in CI environments if `databaseURL` cannot be auto-detected, even if project ID is available.
**Action:** Explicitly provided `projectId` and `databaseURL` in `backend-api/src/firebase.ts` to ensure reliability across all environments.

## 2026-07-12 - Vitest Mock Exports
**Learning:** Vitest dependency tracking requires all functions used in the source (even optional ones) to be explicitly exported from the mock if using `vi.mock`.
**Action:** Added missing `checkAuthOptional` to `auth.middleware` mocks in backend tests.
