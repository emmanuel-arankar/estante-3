# Bolt's Performance Journal

## 2026-04-03 - [Ref-based progress tracking for event listeners]
**Learning:** Using `useCallback` for event handlers that depend on high-frequency state (like `dragProgress`) causes the `useEffect` managing global listeners to re-attach on every state update. This negates the performance benefit and can cause jitter.
**Action:** Use `useRef` to store the high-frequency value and access it inside the `useCallback`. This keeps the callback identity stable and prevents `useEffect` churn.

## 2026-04-03 - [Single-pass Grouping for Sorted Data]
**Learning:** When grouping chronologically sorted data (like chat messages), a single-pass O(N) algorithm that only checks the last group is significantly more efficient than using `.find()` or `.filter()`, which can lead to O(N*G) or O(N^2) complexity.
**Action:** Always prefer single-pass grouping for time-series or sorted datasets.

## 2026-04-03 - [Vitest Mocking: Complete Export Coverage]
**Learning:** When mocking a module with `vi.mock`, all functions exported by the original module that are used in the tested code paths must be included in the mock. Missing exports (like `checkAuthOptional`) cause runtime errors in Vitest.
**Action:** Ensure all used exports are present in `vi.mock` definitions. Use `importOriginal` for partial mocks if needed.

## 2026-04-03 - [Firebase Admin: Test Environment Initialization]
**Learning:** In test environments, `admin.initializeApp()` may fail if it can't determine the Database URL from the environment or service account.
**Action:** Provide explicit fallbacks for `projectId` and `databaseURL` when `process.env.NODE_ENV === 'test'` to ensure connectivity in CI/local tests.
