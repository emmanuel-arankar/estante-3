## 2024-05-30 - Hero Component Optimization
**Learning:** Extracting search state into a standalone `HeroSearchBar` component prevents full-component re-renders on keystrokes, ensuring that expensive background animations and stats remain static while typing. Additionally, using `useMemo` for random animation properties stabilizes visuals and avoids redundant calculations.
**Action:** Always look for state that can be colocated to prevent large-scale re-renders, especially when complex animations or many motion elements are involved.
