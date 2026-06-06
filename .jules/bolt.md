## 2026-06-06 - Optimizing the Hero Component
**Learning:** Using `Math.random()` directly in the render loop for component properties, especially for Framer Motion animations, causes visual jitter and redundant processing as values regenerate on every re-render. Additionally, keeping input state in a large parent component triggers unnecessary full-component re-renders on every keystroke.
**Action:** Extract search state into a standalone component to isolate re-renders. Use `useMemo` to stabilize random animation properties, ensuring they remain constant between renders.
