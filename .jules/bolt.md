## 2025-05-04 - [Chat Performance Optimization]
**Learning:** Large message lists in React are extremely sensitive to referential stability. Even with `React.memo`, a single inline closure in the parent's render loop (like `() => deleteMessage(id)`) invalidates memoization for all children, causing O(N) re-renders on every keystroke or new message. Additionally, message grouping logic that uses `.find()` in a loop creates an O(N*G) complexity which is unnecessary when data is chronologically sorted.

**Action:** Always wrap list item handlers in `useCallback` and design child components to accept stable handlers and pass back their own IDs. Leverage sorted data properties to achieve O(N) grouping. Use `useMemo` for any complex data transformation (like audio waveform scaling) that occurs during high-frequency updates like animation frames.

## 2025-05-04 - [CI Stability and Test Environment Setup]
**Learning:** In a mono-repo/workspace environment, Firebase Admin initialization without a Service Account (ADC mode) requires an explicit `databaseURL` and `projectId` fallback if they aren't provided by the environment, especially during tests. Also, Vitest mocks for middleware must explicitly export all functions used by any route in the system, even if not directly tested in that file, to avoid "export not defined" errors during dependency resolution.

**Action:** Ensure `admin.initializeApp` has sensible fallbacks for tests. When mocking middleware, verify if `checkAuthOptional` or other variants are needed globally.
