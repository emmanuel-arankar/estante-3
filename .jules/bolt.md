## 2024-03-21 - Preventing Animation Jitter and Redundant Re-renders in Hero Components

**Learning:** Using `Math.random()` directly in the render loop for component properties, especially when used with animation libraries like Framer Motion, causes visual jitter because values are regenerated on every re-render. Additionally, keeping input state at the top level of a component with expensive children (like background animations and stats) causes unnecessary performance overhead during typing.

**Action:**
1. Always wrap random value generation in `useMemo` when they are used for visual properties.
2. Extract search/input logic into a standalone component to localize state and prevent parent component re-renders on every keystroke.
