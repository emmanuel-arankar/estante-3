## 2026-05-24 - Hero Component Re-renders and Visual Jitter
**Learning:** Inlining `Math.random()` for visual properties (like Framer Motion animations) within a render loop causes redundant calculations and visual jitter as values regenerate on every re-render. Additionally, keeping input state in a large parent component triggers expensive full-component re-renders on every keystroke.
**Action:** Extract search state into a standalone `SearchBar` component and use `useMemo` to stabilize random animation properties, ensuring they are only generated once.
