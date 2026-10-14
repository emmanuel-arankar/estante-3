# Bolt's Performance Journal

## 2026-10-14 - Editions List Optimization
**Learning:** In list pages like `EditionsPage.tsx` with complex card components containing framer-motion animations, rating components, and shelf action buttons, inline rendering without memoization causes every item in the list to re-render whenever an individual item is expanded/collapsed or rated.
**Action:** Extract list item rendering into a separate subcomponent wrapped in `React.memo` with explicit `displayName` and wrap event handlers in `useCallback` to isolate re-renders to only the changed item.
