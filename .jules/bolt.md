## 2025-05-18 - Hoisting Query Lowercasing in Array Filtering
**Learning:** In list filtering callbacks, invoking `.toLowerCase()` on the search query inside `Array.prototype.filter()` re-computes string transformation N times per item (2N if checking multiple fields).
**Action:** Always compute `const query = searchTerm.toLowerCase().trim()` once outside the filter callback and combine with `useMemo` dependent on `[items, searchTerm]`.
