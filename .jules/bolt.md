## 2025-05-15 - [Memoization of Chat Messages]
**Learning:** In long-running lists like chat history, even simple component re-renders accumulate O(N) overhead. Inline arrow functions in loop iterations are a primary cause of memoization failure as they regenerate on every parent render.
**Action:** Always stabilize list-item callbacks using `useCallback` at the parent root and refactor prop signatures to accept IDs/objects. Use `useRef` for high-frequency state (like `messages` or audio drag progress) inside these callbacks/effects to prevent dependency-induced re-renders of the entire list.

## 2025-05-15 - [Effect Dependency Stabilization]
**Learning:** Attaching global event listeners (e.g., `mousemove`) inside `useEffect` with high-frequency dependencies (like `dragProgress`) causes extreme overhead due to constant listener re-attachment.
**Action:** Use a `useRef` to hold the latest handler logic and keep the `useEffect` dependencies minimal. This ensures listeners are attached once while still having access to the latest state.
