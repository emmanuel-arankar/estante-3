## 2026-07-15 - [Hero component re-render optimization]
**Learning:** Isolating high-frequency state (like search input) into child components and memoizing heavy sibling components (like animated backgrounds) is crucial for maintaining 60fps interaction performance. Using deterministic values for 'random' animations ensures SSR consistency and prevents layout jumps.
**Action:** Always look for high-frequency state updates and check if they can be isolated to prevent parent re-renders.
