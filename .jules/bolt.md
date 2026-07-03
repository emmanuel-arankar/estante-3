## 2025-07-03 - [Hero Component Re-render Isolation]
**Learning:** High-frequency state updates (like typing in a search input) at the top level of a component containing complex animations (like Framer Motion particles) cause significant performance degradation due to redundant re-renders of the entire subtree.
**Action:** Always isolate high-frequency state into standalone leaf components and memoize expensive visual components (backgrounds, decorations) to ensure they only re-render when their specific props change.
