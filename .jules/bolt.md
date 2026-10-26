# Bolt's Journal - Critical Learnings

## 2026-10-26 - Component Memoization in Layout Components
**Learning:** Top-level layout components like `Header` undergo re-renders whenever parent layout state changes (e.g. scroll events toggling "scroll to top" button in `Layout`). Wrapping `Header` in `React.memo` and setting explicit `displayName` prevents unnecessary re-rendering of the navigation bar during page scrolling.
**Action:** When memoizing layout components, wrap with `React.memo`, set `displayName`, and avoid committing lockfile changes unless new dependencies are added.
