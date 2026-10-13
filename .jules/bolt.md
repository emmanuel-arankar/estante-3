# Bolt's Performance Journal

## 2026-10-13 - Stable Callback References for Dynamic Form List Items
**Learning:** In complex form modals like `SuggestionReviewModal`, rendering list item subcomponents (`AuthorEditRow`) with inline arrow functions causes every row to re-render whenever any field in the parent component changes. Refactoring the subcomponent to accept an `index` prop and passing a single memoized `useCallback` handler with functional state updates (`setEditableData(prev => ...)`) preserves `React.memo` reference equality across all list rows.
**Action:** When memoizing list subcomponents with `React.memo`, pass `index` (or ID) as a prop and pass a top-level memoized callback instead of generating inline arrow functions inside `.map()`.
