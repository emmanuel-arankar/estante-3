## 2024-04-14 - Chat Performance and UX optimizations
**Learning:** For high-frequency components like `ChatBubble`, memoization alone is ineffective if callback props are recreated on every parent render. Refactoring props to accept identifiers (e.g., `onDelete(id)`) and stabilizing setters with `useCallback` and `useRef` is essential for real performance gains.
**Action:** Always verify callback stability in parent components when applying `React.memo()` to list items.
