## 2026-05-31 - [Memoization with Callbacks]
**Learning:** Applying `React.memo` to components is ineffective if the parent component passes anonymous functions or non-stabilized callbacks. Re-renders will still occur as props change referentially.
**Action:** Always wrap callbacks passed to memoized components with `useCallback` and ensure dependencies are correctly handled.
