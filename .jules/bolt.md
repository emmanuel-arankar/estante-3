# Bolt's Journal - Critical Learnings

This journal is a record of critical performance learnings for the Estante application.

## 2026-08-01 - Notification List Polling Optimization
**Learning:** React Query queries with `refetchInterval` (polling) trigger periodic updates to components. In `useNotifications.ts`, returning `notificationsQuery.data?.pages.flatMap(...)` directly on every render causes a new array reference to be generated on every single hook call, leading to unnecessary re-renders of the notifications dropdown and item lists even when no new data was fetched.
**Action:** Always wrap list transformations and slice operations on fetched collections in `useMemo`, and wrap list item components in `React.memo` to ensure render cascades are minimized.
