## 2024-05-11 - Stabilizing background animations in Hero component
**Learning:** In the `Hero` component, background animation parameters (random positions, duration, delay) were being re-calculated on every render. Since the search input triggers a re-render on every keystroke, this caused the background dots to "jump" or jitter visually, and performed redundant O(N) calculations.
**Action:** Use `useMemo` to stabilize random values for decorative background elements that should persist across state-triggered re-renders.
