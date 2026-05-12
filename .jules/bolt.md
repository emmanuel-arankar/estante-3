## 2026-05-12 - [Hero Background Jitter]
**Learning:** In the `Hero` component (`src/components/home/Hero.tsx`), the `searchQuery` state triggers a full re-render on every keystroke. Originally, background dot parameters (position, duration, delay) were calculated using `Math.random()` directly in the render loop. This caused visual jitter as dots moved/reset on every keystroke and unnecessary $O(N)$ calculations.
**Action:** Always memoize random or expensive values in components that frequently re-render due to local state (like search inputs).

## 2026-05-12 - [Vitest Partial Mocking Failure]
**Learning:** When mocking a module with Vitest (e.g., `vi.mock('../middleware/auth.middleware')`), failing to export all functions used by the application (even indirectly) leads to "No export defined" errors. In this codebase, many controllers import both `checkAuth` and `checkAuthOptional`.
**Action:** Ensure mocks for internal middlewares are complete or use `importOriginal` for partial mocking.

## 2026-05-12 - [Firebase Admin Initialization in CI]
**Learning:** Initializing Firebase Admin with `admin.initializeApp()` without arguments in a CI environment (where `GOOGLE_APPLICATION_CREDENTIALS` might be missing or limited) can lead to "Can't determine Firebase Database URL" errors if the code later calls `admin.database()`.
**Action:** Provide explicit `projectId` and `databaseURL` fallbacks during initialization in the `firebase.ts` utility to ensure stability in test and CI environments.
