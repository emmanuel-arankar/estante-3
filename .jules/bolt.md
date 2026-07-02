## 2025-05-15 - [Hero component optimization]
**Learning:** High-frequency state updates (like typing in a search input) in a parent component trigger expensive re-renders of all children, including heavy animated nodes. Using `Math.random()` directly in JSX causes visual jitter and redundant layout calculations on every re-render.
**Action:** Isolate high-frequency local state into leaf or sibling components. Memoize heavy decorative components (like backgrounds) and stabilize random/calculated properties with `useMemo` to ensure persistence across renders.
