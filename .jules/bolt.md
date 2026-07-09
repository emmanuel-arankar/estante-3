## 2025-07-09 - Memoization of List Components
**Learning:** In lists with many items (like friends or notifications), every parent re-render (e.g. from a search input) causes all child components to re-render, even if they haven't changed. This is especially noticeable with expensive sub-components like Tooltips or Avatars.
**Action:** Use React.memo for list item components and stable sub-components. Ensure props like callbacks are stable (useCallback or TanStack Query mutations).
