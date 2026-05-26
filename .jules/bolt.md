## 2026-05-26 - Hero component search state extraction
**Learning:** Extracting search state into a standalone component prevents full-component re-renders on keystrokes. In the Hero component, this was particularly expensive because it triggered re-calculation of random animation properties and re-rendering of the entire background and stats on every character typed.
**Action:** Always isolate high-frequency state (like input values) in their own components to avoid expensive parent re-renders. Use `useMemo` for stable random values in render-heavy components like background animations.
