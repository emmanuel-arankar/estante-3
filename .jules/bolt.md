## 2026-08-06 - [Notification UI Render Optimization]
**Learning:** Returning newly constructed arrays or performing inline slice operations breaks down React component memoization, causing downstream children components to redundantly rerender on every state update (such as polling intervals or tab shifts).
**Action:** Always wrap collection mapping, slicing, and filtering operations in custom hooks or components in `useMemo` to ensure stable references, and pair list items with `React.memo` for maximum rendering performance.
