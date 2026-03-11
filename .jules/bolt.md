## 2025-05-14 - Chat Performance Optimizations

**Learning:** Large chat histories were suffering from O(N*G) complexity during message grouping (where G is the number of date groups) because `groups.find` was used in a loop. Also, high-frequency components like `ChatMessage` and `Avatar` were re-rendering unnecessarily due to unstable callback props and lack of memoization.

**Action:** Leverage the sorted nature of chat messages to implement O(N) grouping. Use `React.memo` on frequent components and ensure all callbacks passed to them are stabilized with `useCallback`, refactoring callback signatures to accept IDs/objects where necessary to maintain stability.

## 2025-05-14 - Build and Test Infrastructure Learnings

**Learning:**
1. Vite SSR Build Rule: The `manualChunks` strategy in `vite.config.ts` must use a function-based implementation to avoid bundling externalized modules like 'react' during SSR builds, which prevents 'cannot be included in manualChunks' errors.
2. Repository Logic: The backend's `sanitize` utility automatically collapses multiple whitespaces. Tests must reflect this optimized/canonical output rather than expecting preservation of spaces from removed tags.
3. Environment Setup: Firebase Admin initialization in `backend-api/src/firebase.ts` requires explicit `projectId` and `databaseURL` properties to function correctly in the test environment (Vitest) when not in a managed Firebase environment.

**Action:** Use function-based `manualChunks`. Update tests to expect collapsed whitespaces. Provide explicit config to `admin.initializeApp()` when ADC is insufficient for local test environments.
