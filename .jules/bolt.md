# Bolt's Journal - Critical Learnings

## 2025-01-24 - Optimizing Notifications
**Learning:** In the `useNotifications` hook, the `notifications` array was being derived using `flatMap` on every render, and `NotificationDropdown` was further slicing it, both without memoization. This causes unnecessary re-renders of child components even when data hasn't changed.
**Action:** Apply `useMemo` to derived data in hooks and `React.memo` to list items to ensure stable references and prevent redundant renders.
