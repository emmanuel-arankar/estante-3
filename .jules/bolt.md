## 2026-03-31 - [O(N) Message Grouping & Component Memoization]
**Learning:** In chat applications with chronological messages, grouping by date can be optimized to O(N) by only comparing with the tail of the groups array, instead of using O(N*G) search. Additionally, stabilizing callback props that accept identifiers instead of closing over data is crucial for `React.memo` to be effective.
**Action:** Always prefer single-pass grouping for sorted datasets and refactor prop signatures to be referentially stable.
