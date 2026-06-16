## 2026-06-16 - Hero Component Optimization
**Learning:** High-frequency state updates (like search input) in components with complex background animations cause both performance degradation and visual jitter if animation properties are randomized on each render.
**Action:** Isolate high-frequency state into child components and use `useMemo` to stabilize randomized animation properties.

## 2026-06-16 - CI & Firebase Configuration
**Learning:** Firebase project IDs must be consistent between `.firebaserc`, GitHub Actions workflows, and backend initialization (`admin.initializeApp`). A mismatch leads to "Can't determine Firebase Database URL" or deployment failures.
**Action:** Always verify `.firebaserc` as the source of truth for the project ID (`estante-75463`) and ensure CI environment mocks include all expected middleware exports (`checkAuthOptional`).
