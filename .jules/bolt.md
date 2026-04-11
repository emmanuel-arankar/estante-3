## 2025-05-15 - [Chat Performance Optimization]
**Learning:** React.memo() alone is insufficient when parent components pass unstable arrow functions or closures as props. Consolidating state updates and using stable callback patterns (passing identifiers to handlers) is critical for measurable gains in high-frequency UI like chat.
**Action:** Always wrap parent handlers in useCallback and refactor child component props to accept IDs or stable objects instead of closing over scoped variables.

**Learning:** Algorithmic complexity in list processing (e.g., grouping messages) can quickly become a bottleneck as N grows. Assuming data properties (like chronological order) allows for O(N) instead of O(N*G) complexity.
**Action:** Look for data sortedness or hashable keys to simplify O(N^2) or O(N*G) operations in renders.
