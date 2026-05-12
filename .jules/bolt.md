## 2026-05-12 - [Hero Background Jitter]
**Learning:** In the `Hero` component (`src/components/home/Hero.tsx`), the `searchQuery` state triggers a full re-render on every keystroke. Originally, background dot parameters (position, duration, delay) were calculated using `Math.random()` directly in the render loop. This caused visual jitter as dots moved/reset on every keystroke and unnecessary $O(N)$ calculations.
**Action:** Always memoize random or expensive values in components that frequently re-render due to local state (like search inputs).
