# Bolt's Performance Journal ⚡

## 2026-03-28 - [O(N) Chat Grouping]
**Learning:** In chronologically sorted datasets (like chat messages), grouping items by date using `.find()` or nested loops creates unnecessary O(N*G) complexity. Since the data is already sorted, we only need to compare each item with the tail of the current groups array.
**Action:** Always check if a dataset is sorted before implementing grouping or search logic. Use a single-pass O(N) approach by checking the last group's key.

## 2026-03-28 - [Memoization Identity Stability]
**Learning:** `React.memo()` is only effective if prop identities are stable. Passing inline arrow functions or recreating handlers on every render invalidates memoization.
**Action:** Use `useCallback` for all handlers passed to memoized children. If a handler depends on frequently changing state (like a message list), refactor the handler to accept identifiers (e.g., `id: string`) instead of the whole object, or use the `useRef` stability pattern if needed.

## 2026-03-28 - [Static Asset Hoisting]
**Learning:** Re-allocating static arrays (like emoji lists) or configuration objects inside a component body adds unnecessary pressure to the GC and can cause re-renders if passed as props.
**Action:** Hoist all static constants and configuration objects outside of the React component definition.
