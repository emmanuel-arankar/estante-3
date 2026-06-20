## 2026-06-20 - Hero Component Optimization
**Learning:** Animated backgrounds with `Math.random()` in the render loop cause visual jitter and redundant computations on every parent state update. Isolating high-frequency state (like text input) into child components and memoizing random animation properties significantly improves perceived and actual performance.
**Action:** Always check for `Math.random()` or expensive computations in components that handle frequent state updates (inputs, timers, scroll events). Isolate state into the smallest possible scope.
