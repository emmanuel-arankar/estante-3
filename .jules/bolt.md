## 2026-05-21 - [Performance Optimization: Hero Component]
**Learning:** Extracting search state into a standalone `SearchBar` component in `src/components/home/Hero.tsx` prevents full-component re-renders on keystrokes, ensuring that expensive background animations and stats remain static while typing. Stabilizing `Math.random()` values with `useMemo` also prevents visual jitter.
**Action:** Always look for top-level states that change frequently (like search inputs) and isolate them in sub-components to prevent expensive parent re-renders.
